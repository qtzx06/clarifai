'use client';

import { useState } from 'react';
import { ShaderBackground } from '../components/shader-background';

export default function TestShaderPage() {
  const [useTestShader, setUseTestShader] = useState(true);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black">
      <ShaderBackground testMode={useTestShader} />
      <div className="absolute top-4 left-4 z-10 font-mono text-sm space-y-2">
        <div className="text-white">Shader Test Page</div>
        <button
          onClick={() => setUseTestShader(!useTestShader)}
          className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30"
        >
          {useTestShader ? 'Switch to Main Shader' : 'Switch to Test Shader'}
        </button>
        <div className="text-white/70 text-xs">
          Current: {useTestShader ? 'Test Shader (animated gradient)' : 'Main Shader (SnakeGem)'}
        </div>
      </div>
    </div>
  );
}

