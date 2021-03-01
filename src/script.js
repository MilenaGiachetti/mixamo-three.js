import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as dat from 'dat.gui';
import Stats from 'three/examples/jsm/libs/stats.module';
import waterVertexShader from './shaders/water/vertex.glsl'
import waterFragmentShader from './shaders/water/fragment.glsl'

/************ Base ************/
// Debug
const gui = new dat.GUI();
const debugObject = {}

const guiAnimations = {};
const animationsFolder = gui.addFolder("Animations");

const stats = Stats();
document.body.appendChild(stats.dom);

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

// Loading Manager
const manager = new THREE.LoadingManager();
manager.onLoad = function() {
    // start animation loop & add eventListeners after loading
    tick();
    document.addEventListener("keydown", onDocumentKeyDown, false);
    document.addEventListener("keyup", onDocumentKeyUp, false);
    // hide loading screen
    document.getElementById("loadingScreen").classList.add("fadeOut");
};
manager.onError = function(url) {
	console.log('Error loading ' + url);
};

/************ Models & animations ************/
let mixer = null;
let animationActions = {};
let mannequin = null;

// Mannequin
const fbxLoader = new FBXLoader(manager);
fbxLoader.load("./models/Ch36_nonPBR.fbx", model => {
    mannequin = model;
    mannequin.traverse( 
        function(node) { 
            if(node instanceof THREE.Mesh) { 
                node.castShadow = true; 
            } 
        } 
    );
    mannequin.scale.set(0.01, 0.01, 0.01);
    mixer = new THREE.AnimationMixer(mannequin);
    // Mannequin animations
    let animationsToLoad = ["walking", "idle", "walking_backwards", "running", "left_turn", "right_turn", "macarena", "wave", "swing"];
    for(const animationToLoad of animationsToLoad){
        fbxLoader.load(`./models/animations/${animationToLoad}.fbx`,
            (object) => {
                let animationAction = mixer.clipAction((object).animations[0]);
                animationActions[animationToLoad] = animationAction;
                animationActions[animationToLoad].clampWhenFinished = true;
                guiAnimations[animationToLoad] = () => {
                    mixer.stopAllAction();
                    animationActions[animationToLoad].play();
                };
                animationsFolder.add(guiAnimations, animationToLoad);
                if(animationToLoad == "idle") {
                    animationActions.idle.play();
                }
            }
        )
    }
    scene.add(mannequin);
});

/************ Floor ************/
// Colors
debugObject.depthColor = '#5e98c0'
debugObject.surfaceColor = '#daedf7'

const waterMaterial = new THREE.ShaderMaterial({
    // add shader to material
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
        // UNiFORMS PARA VERTEX SHADER
        // uniform elevación olas
        uBigWavesElevation: { value: 0.6 },
        // uniform frecuencia olas en eje x - z
        uBigWavesFrequency: { value: 1.0 },
        // uniform con valor del elapsed time para animar
        uTime: { value: 0 },
        // uniform para controlar la velocidad de las olas
        uBigWavesSpeed: { value: 0.75 },
        uSmallWavesElevation: { value: 0.75 },
        uSmallWavesFrequency: { value: 0.5 },
        uSmallWavesSpeed: { value: 0.2 },
        uSmallIterations: { value: 3 },
        // UNiFORMS PARA FRAGMENT SHADER
        // colores 
        uDepthColor: { value: new THREE.Color(debugObject.depthColor) },
        uSurfaceColor: { value: new THREE.Color(debugObject.surfaceColor) },
        uColorOffset: { value: 0.08 },
        uColorMultiplier: { value: 1 }
    }
})

const floor = new THREE.Mesh(
    new THREE.RingGeometry( 20, 100, 512, 512 ),
    // new THREE.PlaneGeometry(50, 50, 512, 512),
    waterMaterial
);
floor.receiveShadow = true;
floor.rotation.x = - Math.PI * 0.5;
scene.add(floor);

gui.add(waterMaterial.uniforms.uBigWavesElevation, 'value').min(0).max(1).step(0.001).name('uBigWavesElevation')
gui.add(waterMaterial.uniforms.uBigWavesFrequency, 'value').min(0).max(10).step(0.001).name('uBigWavesFrequency')
gui.add(waterMaterial.uniforms.uBigWavesSpeed, 'value').min(0).max(10).step(0.001).name('uBigWavesSpeed')
gui.add(waterMaterial.uniforms.uSmallWavesElevation, 'value').min(0).max(1).step(0.001).name('uSmallWavesElevation')
gui.add(waterMaterial.uniforms.uSmallWavesFrequency, 'value').min(0).max(30).step(0.001).name('uSmallWavesFrequency')
gui.add(waterMaterial.uniforms.uSmallWavesSpeed, 'value').min(0).max(4).step(0.001).name('uSmallWavesSpeed')
gui.add(waterMaterial.uniforms.uSmallIterations, 'value').min(0).max(5).step(1).name('uSmallIterations')

gui.addColor(debugObject, 'depthColor').onChange(() => { waterMaterial.uniforms.uDepthColor.value.set(debugObject.depthColor) })
gui.addColor(debugObject, 'surfaceColor').onChange(() => { waterMaterial.uniforms.uSurfaceColor.value.set(debugObject.surfaceColor) })
gui.add(waterMaterial.uniforms.uColorOffset, 'value').min(0).max(1).step(0.001).name('uColorOffset')
gui.add(waterMaterial.uniforms.uColorMultiplier, 'value').min(0).max(10).step(0.001).name('uColorMultiplier')

/************ Lights ************/
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFDF4DC, 0.6);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 65;
directionalLight.shadow.camera.left = - 35;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.right = 35;
directionalLight.shadow.camera.bottom = - 20;
directionalLight.position.set(20, 15, 20);
scene.add(directionalLight);

// gui
function updateCamera() {
    // update the light target's matrixWorld because it's needed by the helper
    directionalLight.target.updateMatrixWorld();
    directionalLightHelper.update();
    // update the light's shadow camera's projection matrix
    directionalLight.shadow.camera.updateProjectionMatrix();
    // and now update the camera helper we're using to show the light's shadow camera
    shadowCameraHelper.update();
}

const lightsFolder = gui.addFolder("Lights");
lightsFolder.add(directionalLight, 'intensity').step(0.1).min(0);
lightsFolder.add(directionalLight.shadow.camera, 'far').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera, 'left').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera, 'top').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera, 'right').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera, 'bottom').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera.position, 'x').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera.position, 'y').step(1).onChange(updateCamera);
lightsFolder.add(directionalLight.shadow.camera.position, 'z').step(1).onChange(updateCamera);

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 2);
// scene.add(directionalLightHelper);
// let shadowCameraHelper = new THREE.CameraHelper( directionalLight.shadow.camera );
// scene.add( shadowCameraHelper );

/************ Sizes ************/
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/************ Camera ************/
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
scene.add(camera);

// Orbit Controls
let orbitControls = null; 

/************ User Controls ************/
let modelState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    autoCamera: true,
    dance: false,
};

const danceArray = ['macarena', "wave", "swing"];
let currentDance = null;

function onDocumentKeyDown(event) {
    var keyCode = event.which;
    switch(keyCode) {
        case 17: // control
            if(!modelState.run) {
                if(modelState.forward) {
                    animationActions.running.weight = 1;
                    animationActions.running.play();
                } 
            }
            modelState.dance = false;
            modelState.run = true;
            break;
        case 32: // spacebar
            if(!modelState.dance) {
                let random = Math.floor(Math.random() * danceArray.length);
                currentDance = danceArray[random];
                animationActions[currentDance].play();
            }
            modelState.dance = true;
            break;
        case 37: // left arrow
            if(!modelState.left && !modelState.forward && !modelState.backward) {
                animationActions.left_turn.weight = 1;
                animationActions.left_turn.timeScale = 1.5/1;
                animationActions.left_turn.play();
            }
            modelState.dance = false;
            modelState.left = true;
            break;
        case 38: // up arrow
            if(!modelState.forward) {
                if(modelState.run) {
                    animationActions.running.weight = 1;
                    animationActions.running.play();
                } else {
                    animationActions.walking.weight = 1;
                    animationActions.walking.play();
                }
            }
            modelState.dance = false;
            modelState.forward = true;
            break;
        case 39: // right arrow
            if(!modelState.right && !modelState.forward && !modelState.backward) {   
                animationActions.right_turn.weight = 1;
                animationActions.right_turn.timeScale = 1.5/1;
                animationActions.right_turn.play();
            }
            modelState.dance = false;
            modelState.right = true;
            break;
        case 40: // down arrow
            if(modelState.backward === false) {
                animationActions.walking_backwards.weight = 1;
                animationActions.walking_backwards.play();
            }
            modelState.dance = false;
            modelState.backward = true;
            break;
    }
}
function onDocumentKeyUp(event) {
    var keyCode = event.which;
    switch(keyCode) {
        case 16: // shift
            modelState.autoCamera = !modelState.autoCamera;
            if(!modelState.autoCamera && !orbitControls) {
                orbitControls = new OrbitControls(camera, canvas);
                orbitControls.target = new THREE.Vector3(mannequin.position.x, 2, mannequin.position.z);
                orbitControls.enableDamping = true;
            } else if(modelState.autoCamera && orbitControls) {                
                orbitControls.dispose();
                orbitControls = null;
            }
            break;
        case 17: // control
            modelState.run = false;
            break;
        case 37: // left arrow
            modelState.left = false;
            break;
        case 38: // up arrow
            modelState.forward = false;
            break;
        case 39: // right arrow
            modelState.right = false;
            break;
        case 40: // down arrow
            modelState.backward = false;
            break;
    }
}

function goToIdle(animation) {
    if(animationActions[animation] && animationActions[animation].weight > 0) {
        animationActions[animation].weight -= 0.2;
    } else if (animationActions[animation]) {
        animationActions[animation].stop;
        animationActions.idle.play();
    }
}

function updateMannequin() {
    // forward
    if(modelState.forward) {
        animationActions.idle.stop();
        let angle = - mannequin.rotation.y + Math.PI * 0.5;
        if(modelState.run) {
            animationActions.walking.weight = animationActions.walking.weight <= 0 ? 0 : animationActions.walking.weight - 0.2;
            animationActions.running.weight = animationActions.running.weight >= 3 ? 3 :  animationActions.running.weight + 0.5;
            mannequin.position.x +=  Math.cos(angle) * 0.1;
            mannequin.position.z +=  Math.sin(angle) * 0.1;
        } else {
            animationActions.walking.weight = animationActions.walking.weight >= 3 ? 3 : animationActions.walking.weight + 0.2;
            mannequin.position.x +=  Math.cos(angle) * 0.025;
            mannequin.position.z +=  Math.sin(angle) * 0.025;
        }
    } else {
        goToIdle("walking");
        goToIdle("running");
    }

    // run
    if(!modelState.run && animationActions.running && animationActions.running.weight > 0) {
        goToIdle("running");
        if(modelState.forward) {
            animationActions.walking.weight = animationActions.walking.weight >= 1 ? 1 : animationActions.walking.weight + 0.2;
        }
    }

    // backward
    if(modelState.backward) {
        animationActions.idle.stop();
        let angle = - mannequin.rotation.y + Math.PI * 0.5;
        mannequin.position.x -=  Math.cos(angle) * 0.02;
        mannequin.position.z -=  Math.sin(angle) * 0.02;
    } else {
        goToIdle("walking_backwards");
    }

    // left
    if(modelState.left) {
        mannequin.rotation.y += Math.PI * 0.01;
        if(animationActions.left_turn && (modelState.backward || modelState.forward)) {
            animationActions.left_turn.stop();
        } else {
            animationActions.left_turn.weight = animationActions.left_turn.weight >= 3 ? 3 :  animationActions.left_turn.weight + 0.2;
            animationActions.left_turn.timeScale = 1.5/1;
            animationActions.left_turn.play();
        }
    } else {
        goToIdle("left_turn");
    }

    // right
    if(modelState.right) {
        mannequin.rotation.y -= Math.PI * 0.01;
        if(animationActions.right_turn && (modelState.backward || modelState.forward)) {
            animationActions.right_turn.stop();
        } else {
            animationActions.right_turn.weight = animationActions.right_turn.weight >= 3 ? 3 :  animationActions.right_turn.weight + 0.2;
            animationActions.right_turn.timeScale = 2/1;
            animationActions.right_turn.play();
        }
    } else {
        animationActions.right_turn.stop();
        goToIdle("right_turn");
    }

    // dance
    if(!modelState.dance && animationActions[currentDance]) {
        animationActions[currentDance].stop();
    }
}

/************ Renderer ************/
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/************ Animate ************/
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    if(mixer) {
        mixer.update(deltaTime);
        // Model update
        updateMannequin();
    }

    // Water
    // time for animation
    waterMaterial.uniforms.uTime.value = elapsedTime

    // Update camera
    if(modelState.autoCamera) {
        if(mannequin) {
            let angle = - (mannequin.rotation.y + Math.PI * 0.5);
            if (modelState.backward){
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 5, 4,  mannequin.position.z + Math.sin(angle) * 5), 0.1);
            } else {
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 3, 3,  mannequin.position.z + Math.sin(angle) * 3), 0.1);
            }
            camera.lookAt(mannequin.position.x, 2 ,mannequin.position.z);
        }
    } else if(orbitControls) {
        // Update orbit controls
        orbitControls.update();
    }

    stats.update();

    // Render
    renderer.render(scene, camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
}