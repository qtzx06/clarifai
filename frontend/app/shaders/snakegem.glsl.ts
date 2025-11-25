export const snakegemShader = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iIntro;

// Manual tanh implementation for WebGL 1.0
vec3 tanh(vec3 x) {
    vec3 e2x = exp(2.0 * x);
    return (e2x - 1.0) / (e2x + 1.0);
}

// Smooth easing functions
float easeOutCubic(float x) {
    return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOutQuart(float x) {
    return x < 0.5 ? 8.0 * x * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 4.0) / 2.0;
}

/*================================
=            SnakeGem            =
=         Author: Jaenam         =
================================*/
// Date:    2025-11-10
// License: Creative Commons (CC BY-NC-SA 4.0)
// Modified with intro animation

void mainImage(out vec4 O, vec2 I) {
    // Intro animation progress with easing
    float introEase = easeInOutQuart(iIntro);
    float prelude = 1.0 - introEase;

    vec3 p, c = vec3(0.0);
    vec3 r = iResolution;

    // Start with faster rotation, slow down to slower speed
    float rotSpeed = mix(1.5, 0.8, introEase);
    mat2 R = mat2(cos(iTime / rotSpeed + vec4(0.0, 33.0, 11.0, 0.0)));

    float d = 0.0;
    float s = 0.0;

    // Zoom in effect during intro
    float zoom = mix(0.3, 1.0, easeOutCubic(introEase));

    // Spiral effect at start
    float spiral = sin(iTime * 1.5) * prelude * 0.5;

    for (float i = 0.0; i < 100.0; i += 1.0) {
        // Add spiral offset during intro
        vec2 spiralOffset = vec2(
            cos(spiral + i * 0.1) * prelude * 3.0,
            sin(spiral + i * 0.1) * prelude * 3.0
        );

        p = vec3(d * ((I + spiralOffset) + (I + spiralOffset) - r.xy) / r.y * R * zoom, d - 9.0);
        p.xz *= R;

        // Add wobble during intro
        float wobble = sin(iTime * 2.0 + i * 0.05) * prelude * 0.3;

        s = 0.012 + 0.07 * abs(
            max(
                sin(length(floor(p * 3.0) + dot(sin(p), cos(p.yzx)) / 0.4) + wobble),
                length(p) - 4.0
            ) - i / 100.0
        );
        d += s;

        // Enhanced color during intro
        vec3 colorShift = vec3(1.0, 2.0, 3.0) + prelude * vec3(0.5, 1.0, 1.5);
        c += max(1.3 * sin(i * 0.5 + colorShift) / s, -length(p * p));
    }

    // Brighter during intro, normal after
    float brightness = mix(1200000.0, 800000.0, introEase);
    vec3 finalColor = tanh(c * c / brightness);

    // Fade in with color shift
    float fadeIn = smoothstep(0.0, 0.3, introEase);
    O.rgb = finalColor * fadeIn;
    O.a = 1.0;
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
}
`;

