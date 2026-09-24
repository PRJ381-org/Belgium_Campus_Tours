import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/scroll.js';

/**
 * Glossy, slowly morphing 3D blob (three.js), lit in the dashboard palette.
 * Tilts toward the mouse and spins faster as the hero scrolls away.
 * three.js is loaded on demand so it never delays the first paint; if WebGL
 * isn't available a CSS gradient orb is shown instead.
 */
export default function Orb({ scrollRef }) {
  const mountRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      let THREE;
      let RoomEnvironment;
      let mergeVertices;
      try {
        THREE = await import('three');
        ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
        ({ mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js'));
      } catch {
        setFallback(true);
        return;
      }
      if (disposed) return;

      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setFallback(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 7);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;

      // 96 segments looks smooth and keeps the per-frame morph cheap on phones.
      // A sphere duplicates the vertices along its UV seam and at the poles, so
      // recomputed normals don't match there and a visible line appears. Drop
      // the (unused) UVs and normals and weld those vertices together.
      const sphere = new THREE.SphereGeometry(1.6, 96, 96);
      sphere.deleteAttribute('uv');
      sphere.deleteAttribute('normal');
      const geometry = mergeVertices(sphere);
      sphere.dispose();
      geometry.computeVertexNormals();
      const base = geometry.attributes.position.array.slice();
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x0c1220,
        metalness: 1,
        roughness: 0.14,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        iridescence: 1,
        iridescenceIOR: 1.7,
        iridescenceThicknessRange: [200, 800],
        envMapIntensity: 1.1,
      });
      const blob = new THREE.Mesh(geometry, material);
      scene.add(blob);

      // Coloured rim lights in the dashboard palette.
      const lights = [
        [0x4099ff, 60, [-4, 2.5, 3]],
        [0x2ed8b6, 45, [4, -2, 2.5]],
        [0x7759de, 50, [0, 4, -2]],
        [0xff5370, 20, [3, 3, 1]],
      ];
      lights.forEach(([color, intensity, [x, y, z]]) => {
        const light = new THREE.PointLight(color, intensity, 20, 1.6);
        light.position.set(x, y, z);
        scene.add(light);
      });

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = mount;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      const still = prefersReducedMotion();
      const pos = geometry.attributes.position;
      const v = new THREE.Vector3();
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMouse = (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onMouse, { passive: true });

      // Only animate while the orb is on screen.
      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      io.observe(mount);

      const morph = (t) => {
        for (let i = 0; i < pos.count; i++) {
          v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).normalize();
          const n =
            Math.sin(v.x * 2.1 + t * 0.9) * Math.sin(v.y * 2.4 + t * 1.1) * 0.16 +
            Math.sin(v.z * 3.1 + t * 0.7) * 0.08 +
            Math.sin((v.x + v.y) * 1.5 - t * 0.6) * 0.07;
          v.multiplyScalar(1.6 * (1 + n));
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
      };

      let frame = 0;
      let spin = 0;
      const clock = new THREE.Clock();
      const render = () => {
        frame = requestAnimationFrame(render);
        if (!visible || document.hidden) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const scrollP = scrollRef?.current ?? 0;
        morph(t * 0.8);
        spin += dt * (0.15 + scrollP * 1.5);
        mouse.x += (mouse.tx - mouse.x) * 0.05;
        mouse.y += (mouse.ty - mouse.y) * 0.05;
        blob.rotation.y = spin + mouse.x * 0.35;
        blob.rotation.x = mouse.y * 0.25 + scrollP * 0.6;
        renderer.render(scene, camera);
      };

      if (still) {
        morph(1.2);
        renderer.render(scene, camera);
      } else {
        render();
      }

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onMouse);
        geometry.dispose();
        material.dispose();
        envTexture.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [scrollRef]);

  return (
    <div className="orb" aria-hidden="true">
      <div ref={mountRef} className="orb-canvas" />
      {fallback && <div className="orb-fallback" />}
    </div>
  );
}
