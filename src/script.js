import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

import * as dat from 'dat.gui'

/************ Base ************/
// Debug
const gui = new dat.GUI()
const animationsFolder = gui.addFolder("Animations")
const guiAnimations = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loading Manager
const manager = new THREE.LoadingManager();
manager.onLoad = function ( ) {
    // start animation loop & add eventListeners after loading
    tick();
    document.addEventListener("keydown", onDocumentKeyDown, false);
    document.addEventListener("keyup", onDocumentKeyUp, false);
    // hide loading screen
    document.getElementById("loadingScreen").classList.add("fadeOut");
};
manager.onError = function ( url ) {
	console.log( 'Error loading ' + url );
};

/************ Models & animations ************/
let mixer = null
let animationActions = {}
let mannequin = null

// Mannequin
const fbxLoader = new FBXLoader(manager);
fbxLoader.load("./models/Ch36_nonPBR.fbx", model => {
    mannequin = model
    mannequin.scale.set(0.05, 0.05, 0.05)
    mixer = new THREE.AnimationMixer(mannequin);

    // mixer.addEventListener( 'loop', function( e ) {
    //     animationActions.walking.stop()
    // } )

    // Mannequin animations
    // let animationsToLoad = ["walking", "idle", "walking_backwards", "running", "walking_start", "walking_stop", "walking_turn_180"]
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
                }
                animationsFolder.add(guiAnimations, animationToLoad);
                if(animationToLoad == "idle"){
                    animationActions.idle.play();
                }
            }
        )
    }

    scene.add(mannequin);
});

/************ Floor ************/
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({
        color: '#222222',
        metalness: 0,
        roughness: 0.5
    })
)
floor.receiveShadow = true
floor.rotation.x = - Math.PI * 0.5
scene.add(floor)


/************ Lights ************/
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xFDF4DC, 0.6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

/************ Sizes ************/
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/************ Camera ************/
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
scene.add(camera)

// Orbit Controls
let orbitControls = null; 
// new OrbitControls(camera, canvas)
// orbitControls.target.set(0, 1, 0)
// orbitControls.enableDamping = true

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
            modelState.dance = false;
            modelState.run = true;
            break;
        case 32: // spacebar
            if(!modelState.dance) {
                let random = Math.floor(Math.random() * danceArray.length);
                currentDance = danceArray[random];
                animationActions[currentDance].play()
            }
            modelState.dance = true;
            break;
        case 37: // left arrow
            if(!modelState.left && !modelState.forward && !modelState.backward){   
                animationActions.left_turn.weight = 1;
                animationActions.left_turn.timeScale = 1.5/1 ; 
                animationActions.left_turn.play()
            }
            modelState.dance = false;
            modelState.left = true;
            break;
        case 38: // up arrow
            if(!modelState.forward) {
                animationActions.walking.weight = 1;
                animationActions.walking.play()
            }
            modelState.dance = false;
            modelState.forward = true;
            break;
        case 39: // right arrow
            if(!modelState.right && !modelState.forward && !modelState.backward){   
                animationActions.right_turn.weight = 1;
                animationActions.right_turn.timeScale = 1.5/1 ; 
                animationActions.right_turn.play()
            }
            modelState.dance = false;
            modelState.right = true;
            break;
        case 40: // down arrow
            if(modelState.backward === false) {
                animationActions.walking_backwards.weight = 1;
                animationActions.walking_backwards.play()
            }
            modelState.dance = false;
            modelState.backward = true;
            // mannequin.rotation.y = 0;
            // animationActions.walking.play()
            // mannequin.position.z += 6;
            break;
    }
}
function onDocumentKeyUp(event) {
    var keyCode = event.which;
    switch(keyCode) {
        case 16: // shift
            modelState.autoCamera = !modelState.autoCamera;
            if(!modelState.autoCamera){
                if(!orbitControls){
                    orbitControls = new OrbitControls(camera, canvas)
                    orbitControls.target = new THREE.Vector3(mannequin.position.x, 8, mannequin.position.z);
                    orbitControls.enableDamping = true
                } else {
                    orbitControls.dispose();
                    orbitControls = null;
                }
                // orbitControls.target.set(camera.position);
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

function updateMannequin(){
    // forward
    if(modelState.forward){
        let angle = - mannequin.rotation.y + Math.PI * 0.5;
        mannequin.position.x +=  Math.cos(angle) * 0.1;
        mannequin.position.z +=  Math.sin(angle) * 0.1;
    } else if (animationActions.walking && animationActions.walking.weight > 0){
        animationActions.walking.weight -= 0.1;
    } else if(animationActions.walking){
        animationActions.walking.stop()
        animationActions.idle.play()
    }

    // backward
    if(modelState.backward){
        let angle = - mannequin.rotation.y + Math.PI * 0.5;
        mannequin.position.x -=  Math.cos(angle) * 0.1;
        mannequin.position.z -=  Math.sin(angle) * 0.1;
    } else if (animationActions.walking_backwards && animationActions.walking_backwards.weight > 0){
        animationActions.walking_backwards.weight -= 0.1;
    } else if(animationActions.walking_backwards){
        animationActions.walking_backwards.stop()
        animationActions.idle.play()
    }

    // left
    if(modelState.left){
        mannequin.rotation.y += Math.PI * 0.01;
        if (animationActions.left_turn && (modelState.backward || modelState.forward)){
            animationActions.left_turn.stop()
        } else if(!(modelState.backward || modelState.forward)){
            animationActions.left_turn.weight = 1;
            animationActions.left_turn.timeScale = 1.5/1;
            animationActions.left_turn.play();
        }
    } else if (animationActions.left_turn){
        animationActions.left_turn.stop()
    }

    // right
    if(modelState.right){
        mannequin.rotation.y -= Math.PI * 0.01;
        if (animationActions.right_turn && (modelState.backward || modelState.forward)){
            animationActions.right_turn.stop()
        } else if(!(modelState.backward || modelState.forward)){
            animationActions.right_turn.weight = 1;
            animationActions.right_turn.timeScale = 1.5/1;
            animationActions.right_turn.play();
        }
    } else if (animationActions.right_turn){
        animationActions.right_turn.stop()
    }

    // dance
    if(!modelState.dance && animationActions[currentDance]){
        animationActions[currentDance].stop()
    }
}

/************ Renderer ************/
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/************ Animate ************/
const clock = new THREE.Clock()
let previousTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    if(mixer) {
        mixer.update(deltaTime)
        // Model update
        updateMannequin()
    }
    
    // Update camera
    if (modelState.autoCamera){
        if(mannequin){
            let angle = - (mannequin.rotation.y + Math.PI * 0.5);
            if (modelState.backward){
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 15, 10,  mannequin.position.z + Math.sin(angle) * 15), 0.1)
            } else {
                camera.position.lerp(new THREE.Vector3(mannequin.position.x + Math.cos(angle) * 10, 10,  mannequin.position.z + Math.sin(angle) * 10), 0.1)
            }
            camera.lookAt(mannequin.position.x, 8 ,mannequin.position.z);
        }
    } else if (orbitControls){
        // Update orbit controls
        orbitControls.update()        
    }

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}