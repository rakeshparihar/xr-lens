// WebXR shell (immersive-ar): reticle from hit-test, tap to anchor a label where you pointed.
// The camera image comes from the WebXR Raw Camera Access API (Chrome on Android, 'camera-access').
// Written to the WebXR specs; not yet tested on an AR device.
import * as THREE from 'three';
import { Answer } from './router/ask';

export async function startAR(onAsk: (frame: HTMLCanvasElement, x: number, y: number) => Promise<Answer>, overlay: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.05, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const session = await navigator.xr!.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'anchors'], optionalFeatures: ['camera-access', 'dom-overlay'], domOverlay: { root: overlay },
  } as XRSessionInit);
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  const hitSource = (await session.requestHitTestSource!({ space: viewer }))!;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const binding = new XRWebGLBinding(session, gl);
  let lastHit: XRHitTestResult | null = null;
  let lastView: XRView | null = null;
  const anchored: { anchor: XRAnchor; sprite: THREE.Sprite }[] = [];

  session.addEventListener('select', async () => {
    if (!lastHit || !lastView) return;
    const frameCanvas = readCamera(gl, binding, lastView);
    const anchor = await (lastHit as any).createAnchor();
    if (!anchor || !frameCanvas) return;
    const sprite = labelSprite('…');
    scene.add(sprite);
    anchored.push({ anchor, sprite });
    const a = await onAsk(frameCanvas, frameCanvas.width / 2, frameCanvas.height / 2); // the reticle is at the view centre
    sprite.material.map = labelSprite(a.label ?? 'not sure').material.map;
  });

  renderer.setAnimationLoop((_t, frame: XRFrame) => {
    const ref = renderer.xr.getReferenceSpace()!;
    const pose = frame.getViewerPose(ref);
    lastView = pose?.views[0] ?? null;
    const hits = frame.getHitTestResults(hitSource);
    lastHit = hits[0] ?? null;
    reticle.visible = !!lastHit;
    if (lastHit) reticle.matrix.fromArray(lastHit.getPose(ref)!.transform.matrix);
    for (const { anchor, sprite } of anchored) {
      const p = frame.getPose(anchor.anchorSpace, ref);
      if (p) sprite.position.set(p.transform.position.x, p.transform.position.y + 0.08, p.transform.position.z);
    }
    renderer.render(scene, camera);
  });
}

function readCamera(gl: WebGL2RenderingContext, binding: XRWebGLBinding, view: XRView): HTMLCanvasElement | null {
  const cam = (view as any).camera;
  if (!cam) return null; // camera-access not granted
  const tex = (binding as any).getCameraImage(cam) as WebGLTexture;
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const w = cam.width, h = cam.height, px = new Uint8ClampedArray(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(px, w, h), 0, 0);
  ctx.scale(1, -1); // GL rows are bottom-up
  ctx.drawImage(c, 0, -h);
  return c;
}

export function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,20,24,0.85)';
  ctx.beginPath(); ctx.roundRect(0, 0, 512, 128, 32); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '600 56px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.2, 0.05, 1);
  return s;
}
