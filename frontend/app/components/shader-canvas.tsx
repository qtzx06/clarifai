'use client';

import { useEffect, useRef } from 'react';
import { snakegemShader } from '../shaders/snakegem.glsl';

type ShaderCanvasProps = {
  className?: string;
  introDuration?: number;
};

const quad = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);

const vertexShaderSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const ShaderCanvas = ({ className = '', introDuration = 2.5 }: ShaderCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const duration = Math.max(0.1, introDuration);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported in this browser.');
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error('Unable to create shader.');
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Could not compile shader:\n${info ?? ''}`);
      }
      return shader;
    };

    let program: WebGLProgram | null = gl.createProgram();
    if (!program) return;

    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, snakegemShader);
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Unable to initialize shader program:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      program = null;
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Unable to create buffer.');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const timeLocation = gl.getUniformLocation(program, 'iTime');
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const introLocation = gl.getUniformLocation(program, 'iIntro');

    const globalWindow = typeof window !== 'undefined' ? window : undefined;

    let resizeTimeout: NodeJS.Timeout | null = null;
    const setSize = () => {
      // Debounce resize to avoid ResizeObserver loop warnings
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        const pixelRatio = globalWindow?.devicePixelRatio ?? 1;
        const width = Math.floor(canvas.clientWidth * pixelRatio);
        const height = Math.floor(canvas.clientHeight * pixelRatio);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      }, 0);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (globalWindow?.ResizeObserver) {
      resizeObserver = new globalWindow.ResizeObserver(setSize);
      resizeObserver.observe(canvas);
    } else if (globalWindow) {
      globalWindow.addEventListener('resize', setSize);
    }
    setSize();

    let animationFrame: number;
    const launchTime = performance.now();

    const render = (now: number) => {
      if (!program) return;

      const elapsed = (now - launchTime) / 1000;
      const introProgress = Math.min(1, elapsed / duration);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (timeLocation) {
        gl.uniform1f(timeLocation, elapsed);
      }
      if (resolutionLocation) {
        gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);
      }
      if (introLocation) {
        gl.uniform1f(introLocation, introProgress);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else if (globalWindow) {
        globalWindow.removeEventListener('resize', setSize);
      }

      if (buffer) gl.deleteBuffer(buffer);
      if (program) {
        gl.deleteProgram(program);
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [introDuration]);

  const classes = ['shader-canvas', className].filter(Boolean).join(' ');

  return <canvas ref={canvasRef} className={classes} style={{ display: 'block', width: '100%', height: '100%' }} />;
};

export default ShaderCanvas;
