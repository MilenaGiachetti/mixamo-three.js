import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import Stats from 'three/examples/jsm/libs/stats.module';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as dat from 'dat.gui';
import CANNON from 'cannon';
import CannonDebugRenderer from './utils/cannonDebugRenderer.js';
// import waterVertexShader from './shaders/water/vertex.glsl';
// import waterFragmentShader from './shaders/water/fragment.glsl';

/************ Base ************/
// Debug
const gui = new dat.GUI();
const debugObject = {
    islandColor: '#dbe7f2',
    boundingSphereColor: '#06012d'
};

gui.addColor(debugObject, 'islandColor').onChange(() => {islandMaterial.color.set(debugObject.islandColor)});
gui.addColor(debugObject, 'boundingSphereColor').onChange(() => {boundingSphereMaterial.color.set(debugObject.boundingSphereColor)});


const guiAnimations = {};
const animationsFolder = gui.addFolder("Animations");

const stats = Stats();
document.body.appendChild(stats.dom);


// Control instructions
document.getElementById("controlsOpen").addEventListener("click", ()=>{
    document.getElementById("controlsPanel").classList.remove("fadeOut");
})
document.getElementById("controlsClose").addEventListener("click", ()=>{
    document.getElementById("controlsPanel").classList.add("fadeOut");
})

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

// Physics
const world = new CANNON.World();
world.gravity.set(0, - 9.82, 0);
const cannonDebugRenderer = new THREE.CannonDebugRenderer( scene, world );

const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.1,
        restitution: 0.7
    }
);
world.addContactMaterial(defaultContactMaterial);

/************ Models & animations ************/
let mixer = null;
let animationActions = {};
let mannequin = null;
let mannequinBody = null;

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
    // Add mannequin physic object
    const mannequinObject = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
    mannequinBody = new CANNON.Body({
        mass: 50,
        position: new CANNON.Vec3(0, 1, 0),
        shape: mannequinObject,
        material: defaultMaterial
    });
    mannequinBody.angularDamping = 1;
    world.addBody(mannequinBody);

    scene.add(mannequin);
});

/************ Head ************/
let head;
const objLoader = new OBJLoader(manager);
const folderHead = gui.addFolder( 'Head' );
objLoader.load("./models/female_head.OBJ", model => {
    console.log(model);
    head = model;
    model.scale.set(3, 3, 3);
    model.position.set( -12, 3.1, 40);
    model.rotation.reorder('YXZ')
    model.rotation.y = Math.PI * 0.05;
    model.rotation.x = Math.PI * 1.75;
    // model.rotateX(9);
    scene.add(model);
    folderHead.add( head.rotation, 'x', 0,  Math.PI * 2, 0.0001 );
    folderHead.add( head.rotation, 'y', 0,  Math.PI * 2, 0.0001 );
    folderHead.add( head.rotation, 'z', 0,  Math.PI * 2, 0.0001 );
    folderHead.add( head.position, 'x', -60,  60, 0.1 );
    folderHead.add( head.position, 'y', -60,  60, 0.1 );
    folderHead.add( head.position, 'z', -60,  60, 0.1 );
    folderHead.open();
});

// const textureLoader = new THREE.TextureLoader(manager)

// const colorTexture = textureLoader.load('/textures/moon/moon_color.jpg')

const moonGeometry = new THREE.SphereGeometry( 3, 32, 32 );
const moonMaterial = new THREE.MeshBasicMaterial( {color: 0xf2f2f2} );
const moon = new THREE.Mesh( moonGeometry, moonMaterial );
moon.position.set( 0, 15, 55);
scene.add( moon );

/************ Sky ************/
let sun = new THREE.Vector3();

// Skybox

const sky = new Sky();
sky.scale.setScalar( 10000 );
scene.add( sky );

const skyUniforms = sky.material.uniforms;

skyUniforms[ 'turbidity' ].value = 10;
skyUniforms[ 'rayleigh' ].value = 2;
skyUniforms[ 'mieCoefficient' ].value = 0.005;
skyUniforms[ 'mieDirectionalG' ].value = 0.8;

const parameters = {
    inclination: 0.490,
    azimuth: 0.75
};

const folderSky = gui.addFolder( 'Sky' );
folderSky.add( parameters, 'inclination', 0, 0.5, 0.0001 ).onChange( updateSun );
folderSky.add( parameters, 'azimuth', 0, 1, 0.0001 ).onChange( updateSun );
folderSky.open();

/************ Sea ************/
// Water
const waterGeometry = new THREE.PlaneGeometry( 10000, 10000 );

let water = new Water(
    waterGeometry,
    {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', function ( texture ) {

            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

        } ),
        alpha: 1.0,
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    }
);

water.rotation.x = - Math.PI / 2;

scene.add( water );

const waterUniforms = water.material.uniforms;

const folderWater = gui.addFolder( 'Water' );
folderWater.add( waterUniforms.distortionScale, 'value', 0, 8, 0.1 ).name( 'distortionScale' );
folderWater.add( waterUniforms.size, 'value', 0.1, 10, 0.1 ).name( 'size' );
folderWater.add( waterUniforms.alpha, 'value', 0.9, 1, .001 ).name( 'alpha' );
folderWater.open();

/************ Island ************/
const islandGeometry = new THREE.PlaneGeometry(100, 100);
const islandMaterial = new THREE.MeshStandardMaterial({color: debugObject.islandColor});
const island = new THREE.Mesh(islandGeometry, islandMaterial);
island.rotation.x = - Math.PI * 0.5;
island.position.y = -0.1;
island.receiveShadow = true;
scene.add(island);

const islandShape = new CANNON.Plane() // plano infinito
const islandBody = new CANNON.Body()
islandBody.mass = 0;
islandBody.quaternion.setFromAxisAngle(new CANNON.Vec3(- 1, 0, 0), Math.PI * 0.5);
islandBody.position.y = -0.1;
islandBody.material = defaultMaterial;
islandBody.addShape(islandShape);
world.addBody(islandBody);
// const geometry = new THREE.SphereGeometry(75, 8, 6);
// const material = new THREE.MeshStandardMaterial({color: 0xEFD381});
// const island = new THREE.Mesh(geometry, material);
// island.position.y = -75;
// island.receiveShadow = true;
// scene.add(island);

// const islandShape = new CANNON.Sphere(75);
// const islandBody = new CANNON.Body();
// islandBody.position.y = -75;
// islandBody.mass = 0;
// islandBody.addShape(islandShape);
// world.addBody(islandBody);

/************ Interactive elements ************/
// Box
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const boxMaterial = new THREE.MeshStandardMaterial({color: 0x7EBDC2});
const box = new THREE.Mesh(boxGeometry, boxMaterial);
box.receiveShadow = true;
box.position.set(2, 0.5, 3);
scene.add(box);

const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
const boxBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(2, 1, 3),
    shape: boxShape,
    material: defaultMaterial
});
boxBody.addShape(boxShape);
world.addBody(boxBody);

// Sphere - ball
const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 6);
const sphereMaterial = new THREE.MeshStandardMaterial({color: 0x36b330});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.receiveShadow = true;
sphere.position.set(-2, 0.5, -3);
scene.add(sphere);

const sphereShape = new CANNON.Sphere(0.2);
const sphereBody = new CANNON.Body({
    mass: 0.1,
    position: new CANNON.Vec3(-2, 1, -3),
    shape: sphereShape,
    material: defaultMaterial
});
sphereBody.addShape(sphereShape);
world.addBody(sphereBody);


/************ Lights ************/
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xf5d787, 1.0);
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
        case 16: // shift - run
            if(!modelState.run) {
                if(modelState.forward) {
                    animationActions.running.weight = 1;
                    animationActions.running.play();
                } 
            }
            modelState.dance = false;
            modelState.run = true;
            break;
        // case 17: // control - crouch / use alternative key for mac
        //     break;
        // case 32: // spacebar - jump
        //     break;
        case 90: // letter z - dance
            if(!modelState.dance) {
                let random = Math.floor(Math.random() * danceArray.length);
                currentDance = danceArray[random];
                animationActions[currentDance].play();
            }
            modelState.dance = true;
            break;
        case 65: // letter a
        case 37: // left arrow
            if(!modelState.left && !modelState.forward && !modelState.backward) {
                animationActions.left_turn.weight = 1;
                animationActions.left_turn.timeScale = 1.5/1;
                animationActions.left_turn.play();
            }
            modelState.dance = false;
            modelState.left = true;
            break;
        case 87: // letter w
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
        case 68: // letter d
        case 39: // right arrow
            if(!modelState.right && !modelState.forward && !modelState.backward) {   
                animationActions.right_turn.weight = 1;
                animationActions.right_turn.timeScale = 1.5/1;
                animationActions.right_turn.play();
            }
            modelState.dance = false;
            modelState.right = true;
            break;
        case 83: // letter s
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
        case 9: // tab - camera toggle
            modelState.autoCamera = !modelState.autoCamera;
            if(!modelState.autoCamera && !orbitControls) {
                orbitControls = new OrbitControls(camera, canvas);
                orbitControls.target = new THREE.Vector3(mannequin.position.x, mannequin.position.y + 2, mannequin.position.z);
                orbitControls.enableDamping = true;
            } else if(modelState.autoCamera && orbitControls) {                
                orbitControls.dispose();
                orbitControls = null;
            }
            break;
        case 16: // shift - run
            modelState.run = false;
            break;
        // case 17: // control - crouch / use alternative key for mac
        //     modelState.crouch = false;
        //     break;
        case 65: // letter a
        case 37: // left arrow
            modelState.left = false;
            break;
        case 87: // letter w
        case 38: // up arrow
            modelState.forward = false;
            break;
        case 68: // letter d
        case 39: // right arrow
            modelState.right = false;
            break;
        case 83: // letter s
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
            mannequinBody.position.x +=  Math.cos(angle) * 0.1;
            mannequinBody.position.z +=  Math.sin(angle) * 0.1;
        } else {
            animationActions.walking.weight = animationActions.walking.weight >= 3 ? 3 : animationActions.walking.weight + 0.2;
            mannequinBody.position.x +=  Math.cos(angle) * 0.025;
            mannequinBody.position.z +=  Math.sin(angle) * 0.025;
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
        mannequinBody.position.x -=  Math.cos(angle) * 0.02;
        mannequinBody.position.z -=  Math.sin(angle) * 0.02;
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

    water.material.uniforms[ 'time' ].value += 1.0 / (60.0 * 3);

    if(mixer) {
        mixer.update(deltaTime);
        // Model update
        updateMannequin();
    }

    // Update camera
    if(mannequin) {
        // Update physics
        world.step(1 / 60, deltaTime, 3);
        mannequin.position.set(mannequinBody.position.x, mannequinBody.position.y - 1.0, mannequinBody.position.z);
        box.position.copy(boxBody.position);
        box.quaternion.copy(boxBody.quaternion);

        sphere.position.copy(sphereBody.position);

        if(modelState.autoCamera) {
            let angle = - (mannequin.rotation.y + Math.PI * 0.5);
            if (modelState.backward){
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 5, mannequin.position.y + 4,  mannequin.position.z + Math.sin(angle) * 5), 0.1);
            } else {
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 3, mannequin.position.y + 3,  mannequin.position.z + Math.sin(angle) * 3), 0.1);
            }
            camera.lookAt(mannequin.position.x, mannequin.position.y + 2 ,mannequin.position.z);
        } else if(orbitControls) {
            // Update orbit controls
            orbitControls.update();
        }
    }

    stats.update();
    cannonDebugRenderer.update(); 

    // Render
    renderer.render(scene, camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
}

/************ update sun ************/
const pmremGenerator = new THREE.PMREMGenerator( renderer );

function updateSun() {

    const theta = Math.PI * ( parameters.inclination - 0.5 );
    const phi = 2 * Math.PI * ( parameters.azimuth - 0.5 );

    sun.x = Math.cos( phi );
    sun.y = Math.sin( phi ) * Math.sin( theta );
    sun.z = Math.sin( phi ) * Math.cos( theta );

    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

    scene.environment = pmremGenerator.fromScene( sky ).texture;

}

updateSun();