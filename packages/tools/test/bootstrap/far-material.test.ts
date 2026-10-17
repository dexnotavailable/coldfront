import {
  DepthTexture,
  Matrix3,
  Matrix4,
  type MeshLambertMaterial,
  PerspectiveCamera,
  Plane,
  ShaderChunk,
  ShaderLib,
  Vector3,
  type WebGLRenderer,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  FAR_NEAR_COVERAGE_GLSL,
  FarTerrainCoverage,
} from "../../../client/src/engine/far-terrain-coverage.js";
import { createTerrainMaterials } from "../../../client/src/engine/terrain-material.js";

function compile(material: MeshLambertMaterial) {
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.lambert.vertexShader,
    fragmentShader: ShaderLib.lambert.fragmentShader,
  };
  material.onBeforeCompile(
    shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
    {} as WebGLRenderer,
  );
  return shader;
}

describe("far terrain material ABI (CPU contracts, not GPU validation)", () => {
  it("keeps five near classes and shares presentation while isolating every far depth uniform", () => {
    const coverage = new FarTerrainCoverage();
    const near = createTerrainMaterials(new Plane());
    const far = createTerrainMaterials(new Plane(), {
      mode: "far",
      shared: near,
      coverage,
    });
    const depth = new DepthTexture(2, 2);
    const textureDisposed = vi.fn();
    near.texture.addEventListener("dispose", textureDisposed);
    const materialDisposed = far.materials.map((material) => {
      const spy = vi.fn();
      material.addEventListener("dispose", spy);
      return spy;
    });
    try {
      expect(near.materials).toHaveLength(5);
      expect(far.materials).toHaveLength(5);
      expect(far.texture).toBe(near.texture);
      expect(far.ownsTexture).toBe(false);
      expect(near.ownsTexture).toBe(true);
      for (const key of [
        "viewMode",
        "tiles",
        "cut",
        "display",
        "night",
        "origin",
        "pop",
        "popActive",
        "pixelScale",
      ] as const)
        expect(far.uniforms[key]).toBe(near.uniforms[key]);
      for (const key of [
        "waterDepth",
        "waterDepthSize",
        "waterDepthLinearize",
        "waterDepthReady",
      ] as const)
        expect(far.uniforms[key]).not.toBe(near.uniforms[key]);
      far.uniforms.waterDepth.value = depth;
      far.uniforms.waterDepthReady.value = 1;
      far.uniforms.waterDepthSize.value.set(800, 600);
      far.uniforms.waterDepthLinearize.value.set(1 / 200, 1 / 16000 - 1 / 200);
      expect(near.uniforms.waterDepth.value).toBeNull();
      expect(near.uniforms.waterDepthReady.value).toBe(0);
      expect(near.uniforms.waterDepthSize.value.toArray()).toEqual([1, 1]);
      expect(near.uniforms.waterDepthLinearize.value.toArray()).toEqual([0, 0]);
      for (const [kind, material] of far.materials.entries()) {
        const original = near.materials[kind];
        expect(original).toBeDefined();
        expect(material.alphaTest).toBe(original?.alphaTest);
        expect(material.opacity).toBe(original?.opacity);
        expect(material.transparent).toBe(original?.transparent);
        expect(material.depthWrite).toBe(original?.depthWrite);
        expect(material.customProgramCacheKey()).not.toBe(
          original?.customProgramCacheKey(),
        );
      }
      far.dispose();
      far.dispose();
      expect(materialDisposed.every((spy) => spy.mock.calls.length === 1)).toBe(
        true,
      );
      expect(textureDisposed).not.toHaveBeenCalled();
      near.dispose();
      near.dispose();
      expect(textureDisposed).toHaveBeenCalledOnce();
    } finally {
      far.dispose();
      near.dispose();
      coverage.dispose();
      depth.dispose();
    }
  });

  it("uses direct fractional positions, batched world/depth/normal math and Three's projection exactly once", () => {
    const coverage = new FarTerrainCoverage();
    const near = createTerrainMaterials(new Plane());
    const far = createTerrainMaterials(new Plane(), {
      mode: "far",
      shared: near,
      coverage,
    });
    try {
      for (const [kind, material] of far.materials.entries()) {
        const shader = compile(material);
        const nearMaterial = near.materials[kind];
        if (!nearMaterial) throw new Error("Near material missing");
        const nearShader = compile(nearMaterial);
        expect(nearShader.vertexShader).toContain(
          "float px = mod(aPackedPosition,64.0)",
        );
        expect(nearShader.vertexShader).not.toContain("cfTerrainPosition");
        expect(nearShader.fragmentShader).not.toContain("cfNearCovers");
        expect(shader.vertexShader).not.toContain("aPackedPosition");
        expect(shader.vertexShader).toContain(
          "vec3 transformed = vec3(position)",
        );
        expect(shader.vertexShader).toContain(
          "cfTerrainPosition = batchingMatrix * cfTerrainPosition",
        );
        expect(shader.vertexShader).toContain(
          "mat3(modelMatrix)*cfTerrainPosition.xyz + (modelMatrix[3].xyz-uRenderOrigin)",
        );
        expect(shader.vertexShader).toContain(
          "inverseTransformDirection(transformedNormal,viewMatrix)",
        );
        expect(shader.vertexShader).toContain(
          "#include <defaultnormal_vertex>",
        );
        expect(ShaderChunk.defaultnormal_vertex).toContain(
          "mat3( batchingMatrix )",
        );
        expect(
          shader.vertexShader.match(/#include <project_vertex>/g),
        ).toHaveLength(1);
        expect(shader.vertexShader).not.toContain(
          "transformed = (batchingMatrix",
        );
        expect(ShaderChunk.project_vertex).toContain(
          "batchingMatrix * mvPosition",
        );
        expect(
          shader.vertexShader.includes(
            "abs((modelViewMatrix * cfTerrainPosition).z)",
          ),
        ).toBe(kind < 2);
        expect(shader.fragmentShader).toContain(FAR_NEAR_COVERAGE_GLSL);
        expect(shader.fragmentShader).toContain(
          "cfNearCovers((absoluteWorld-vVoxelNormal*0.001).xz)",
        );
        expect(shader.fragmentShader.includes("float waterPath=")).toBe(
          kind === 3,
        );
        expect(
          shader.fragmentShader.includes("float cfLavaEmissionGain(float w)"),
        ).toBe(kind === 4);
      }
      // Concrete r186 matrices: page translated to the rebase, instance to the
      // tile minus that rebase. A different origin must not move the surface.
      const vertex = new Vector3(4.25, 1548.5, 12.75);
      const tileOrigin = new Vector3(-21888, -1536, 21760);
      const expected = vertex.clone().add(tileOrigin);
      const camera = new PerspectiveCamera(70, 16 / 9, 200, 16000);
      camera.position.set(-21000, 420, 22000);
      camera.lookAt(expected);
      camera.updateMatrixWorld(true);
      const projections: Vector3[] = [];
      const distances: number[] = [];
      for (const origin of [
        new Vector3(-21504, 0, 21504),
        new Vector3(-20480, 0, 22528),
      ]) {
        const model = new Matrix4().makeTranslation(
          origin.x,
          origin.y,
          origin.z,
        );
        const batch = new Matrix4().makeTranslation(
          tileOrigin.x - origin.x,
          tileOrigin.y - origin.y,
          tileOrigin.z - origin.z,
        );
        const batchVertex = vertex.clone().applyMatrix4(batch);
        const relative = batchVertex
          .clone()
          .applyMatrix3(new Matrix3().setFromMatrix4(model))
          .add(new Vector3().setFromMatrixPosition(model).sub(origin));
        expect(relative.clone().add(origin).distanceTo(expected)).toBeLessThan(
          1e-9,
        );
        const modelView = new Matrix4().multiplyMatrices(
          camera.matrixWorldInverse,
          model,
        );
        const view = batchVertex.clone().applyMatrix4(modelView);
        distances.push(-view.z);
        projections.push(view.applyMatrix4(camera.projectionMatrix));
      }
      expect(
        projections[0]?.distanceTo(projections[1] as Vector3),
      ).toBeLessThan(1e-9);
      expect(distances[0]).toBeCloseTo(distances[1] as number, 9);
    } finally {
      far.dispose();
      near.dispose();
      coverage.dispose();
    }
  });
});

describe("actual near coverage", () => {
  it("masks ready drawn 32/64 m footprints with holes and negative half-open boundaries", () => {
    const coverage = new FarTerrainCoverage();
    try {
      coverage.update([
        { minX: -64, minZ: -32, maxX: -32, maxZ: 0, ready: true, drawn: true },
        { minX: 0, minZ: 0, maxX: 64, maxZ: 64, ready: true, drawn: true },
        { minX: -32, minZ: -32, maxX: 0, maxZ: 0, ready: false, drawn: true },
        { minX: 64, minZ: 0, maxX: 96, maxZ: 32, ready: true, drawn: false },
      ]);
      expect(coverage.covers(-64, -32)).toBe(true);
      expect(coverage.covers(-32.001, -0.001)).toBe(true);
      expect(coverage.covers(-32, -1)).toBe(false);
      expect(coverage.covers(-64.001, -1)).toBe(false);
      expect(coverage.covers(0, 0)).toBe(true);
      expect(coverage.covers(63.999, 63.999)).toBe(true);
      expect(coverage.covers(64, 0)).toBe(false);
      expect(coverage.covers(32, 64)).toBe(false);
      // A high-altitude caller withdrawing drawn coverage must reveal far now.
      coverage.update([]);
      expect(coverage.covers(1, 1)).toBe(false);
      expect(coverage.mask.value.image.data).toEqual(new Uint8Array([0]));
    } finally {
      coverage.dispose();
    }
  });

  it("keeps updates atomic, avoids unchanged uploads and disposes replaced textures once", () => {
    const coverage = new FarTerrainCoverage();
    const column = {
      minX: 0,
      minZ: 0,
      maxX: 32,
      maxZ: 32,
      ready: true,
      drawn: true,
    };
    try {
      coverage.update([column]);
      const old = coverage.mask.value;
      const version = old.version;
      const disposed = vi.fn();
      old.addEventListener("dispose", disposed);
      coverage.update([{ ...column }]);
      expect(old.version).toBe(version);
      expect(() => coverage.update([{ ...column, maxX: 33 }])).toThrow(
        "aligned",
      );
      expect(() => coverage.update([{ ...column, maxX: 32 * 2049 }])).toThrow(
        "capacity",
      );
      expect(coverage.covers(0, 0)).toBe(true);
      expect(coverage.mask.value).toBe(old);
      coverage.update([{ ...column, maxX: 64 }]);
      expect(disposed).toHaveBeenCalledOnce();
      expect(coverage.covers(63.99, 0)).toBe(true);
      const current = coverage.mask.value;
      const currentDisposed = vi.fn();
      current.addEventListener("dispose", currentDisposed);
      const restoredVersion = current.version;
      coverage.contextRestored();
      expect(current.version).toBeGreaterThan(restoredVersion);
      coverage.dispose();
      coverage.dispose();
      expect(currentDisposed).toHaveBeenCalledOnce();
      expect(() => coverage.update([])).toThrow("disposed");
    } finally {
      coverage.dispose();
    }
  });
});
