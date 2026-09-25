/**
 * World terrain: one heightfield mesh driven by lib/terrain (analytic; the bike
 * samples the same function, so ground contact is always exact). Vertex colours
 * paint salt flats / dunes / glass canyon. Scatter is instanced and seeded.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { terrainHeight, terrainNormal, vertexColor } from '../lib/terrain';
import { mulberry32 } from '../lib/noise';
import { WORLD_SIZE } from '../world/layout';
import { REGIONS, allColliders } from '../world/registry';

const SEGMENTS = 200;

function useTerrainGeometry() {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const n = { x: 0, y: 1, z: 0 };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      // finite-difference slope for colouring
      const slope = Math.abs(terrainHeight(x + 4, z) - h) + Math.abs(terrainHeight(x, z + 4) - h);
      terrainNormal(x, z, n);
      vertexColor(x, z, h, slope * 0.25, colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function Scatter() {
  const { rocks, spires, shrubs } = useMemo(() => {
    const rand = mulberry32(777);
    const anchors: [number, number][] = [];
    const colliders = allColliders();
    for (const region of REGIONS.values()) {
      for (const a of Object.values(region.anchors)) anchors.push(a.pos);
    }
    const nearAnchor = (x: number, z: number, d = 26) => anchors.some(([ax, az]) => (ax - x) ** 2 + (az - z) ** 2 < d * d);
    const place = (
      count: number,
      test: (x: number, z: number, h: number) => boolean,
      scale: () => [number, number, number],
    ) => {
      const items: { x: number; y: number; z: number; ry: number; s: [number, number, number] }[] = [];
      let guard = count * 6;
      while (items.length < count && guard-- > 0) {
        const x = (rand() - 0.5) * (WORLD_SIZE - 340);
        const z = (rand() - 0.5) * (WORLD_SIZE - 340);
        const h = terrainHeight(x, z);
        if (nearAnchor(x, z)) continue;
        if (colliders.some((c) => Math.abs(c.pos[0] - x) < c.size[0] && Math.abs(c.pos[1] - z) < c.size[2])) continue;
        if (!test(x, z, h)) continue;
        items.push({ x, y: h, z, ry: rand() * Math.PI * 2, s: scale() });
      }
      return items;
    };
    const rocks = place(700, (_x, _z, h) => h > 4, () => {
      const s = 0.6 + rand() * 2.4;
      return [s, s * (0.5 + rand() * 0.6), s];
    });
    const spires = place(220, (_x, _z, h) => h < 3.4, () => {
      const s = 0.5 + rand() * 1.3;
      return [s, s * (2 + rand() * 2.4), s];
    });
    const shrubs = place(500, (_x, _z, h) => h > 2.5 && h < 24, () => {
      const s = 0.5 + rand() * 0.8;
      return [s, s * 0.8, s];
    });
    return { rocks, spires, shrubs };
  }, []);

  const meshes = useMemo(() => {
    const dummy = new THREE.Object3D();
    const build = (
      items: { x: number; y: number; z: number; ry: number; s: [number, number, number] }[],
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
    ) => {
      const m = new THREE.InstancedMesh(geometry, material, items.length);
      items.forEach((it, i) => {
        dummy.position.set(it.x, it.y + it.s[1] * 0.28, it.z);
        dummy.rotation.set(0, it.ry, 0);
        dummy.scale.set(...it.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = false;
      m.receiveShadow = true;
      return m;
    };
    return {
      rockMesh: build(
        rocks,
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: '#8A5A34', flatShading: true, roughness: 1 }),
      ),
      spireMesh: build(
        spires,
        new THREE.ConeGeometry(1, 2.6, 5),
        new THREE.MeshStandardMaterial({ color: '#F3EEE2', flatShading: true, roughness: 0.9 }),
      ),
      shrubMesh: build(
        shrubs,
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: '#6E7A3A', flatShading: true, roughness: 1 }),
      ),
    };
  }, [rocks, spires, shrubs]);

  return (
    <group>
      <primitive object={meshes.rockMesh} />
      <primitive object={meshes.spireMesh} />
      <primitive object={meshes.shrubMesh} />
    </group>
  );
}

export default function Terrain() {
  const geometry = useTerrainGeometry();
  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      <Scatter />
    </group>
  );
}
