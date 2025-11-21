'use client';

import { useEffect, useRef } from 'react';
import { snakegemShader } from '../shaders/snakegem.glsl';

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export function ShaderBackground({ testMode = false }: { testMode?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Simple test shader to verify WebGL works
  const testFragmentShader = `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;
    
    void main() {
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      vec3 color = vec3(
        sin(uv.x * 10.0 + iTime) * 0.5 + 0.5,
        sin(uv.y * 10.0 + iTime * 1.1) * 0.5 + 0.5,
        sin((uv.x + uv.y) * 5.0 + iTime * 1.2) * 0.5 + 0.5
      );
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  useEffect(() => {
    console.log('ShaderBackground useEffect running, testMode:', testMode);
    console.log('snakegemShader length:', snakegemShader.length);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas ref is null');
      return;
    }

    let gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) {
      console.error('WebGL not supported - trying webgl2');
      gl = canvas.getContext('webgl2') as WebGLRenderingContext | null;
      if (!gl) {
        console.error('WebGL not supported on this browser');
        return;
      }
    }

    // Create shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const fragmentShaderSource = testMode ? testFragmentShader : snakegemShader;
    
    gl.shaderSource(vs, vertexShader);
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(vs);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return;
    }
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fs);
      console.error('Fragment shader error:', error);
      console.error('Using testMode:', testMode);
      console.error('Shader source length:', fragmentShaderSource.length);
      // Log first 500 chars of shader for debugging
      console.error('Shader source preview:', fragmentShaderSource.substring(0, 500));
      return;
    }
    
    console.log('Shader compiled successfully, testMode:', testMode);

    // Create program
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Setup geometry (full screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const timeLocation = gl.getUniformLocation(program, 'iTime');

    // Resize handler
    const setSize = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      // Ensure canvas has dimensions
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
      }
      const width = Math.floor(canvas.clientWidth * pixelRatio);
      const height = Math.floor(canvas.clientHeight * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        console.log('Canvas resized:', width, height);
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(setSize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', setSize);
    }
    setSize();

    // Animation loop
    const launchTime = performance.now();
    let frameCount = 0;
    const render = (now: number) => {
      if (!program) return;

      const elapsed = (now - launchTime) / 1000.0;
      
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (timeLocation) {
        gl.uniform1f(timeLocation, elapsed);
      }
      if (resolutionLocation) {
        gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      if (frameCount === 0) {
        console.log('Shader rendering started', {
          canvasSize: `${canvas.width}x${canvas.height}`,
          time: elapsed,
          testMode
        });
      }
      frameCount++;
      
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', setSize);
      }
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) {
        gl.deleteProgram(program);
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [testMode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, display: 'block', width: '100%', height: '100%' }}
    />
  );
}

