import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import Stats from 'three/examples/jsm/libs/stats.module';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as dat from 'dat.gui';
import * as CANNON from 'cannon-es';
import cannonDebugger from 'cannon-es-debugger';

function main() {
    const DEBUG = window.location.hash === "#debug" ? true : false;
    /************ Base ************/
    // Canvas
    const canvas = document.querySelector('canvas.webgl');
    
    // Scene
    const scene = new THREE.Scene();
    
    // Loading Manager
    const loaderElement = document.querySelector('.loader');
    const manager = new THREE.LoadingManager();
    manager.onLoad = function() {
        window.setTimeout(() => {
            // Hide loading bar
            loaderElement.classList.add("loaded");
            loaderElement.style.transform = ''
            // Add start button
            document.getElementById("startApp").classList.add("fadeIn");
            // Initialize animation
            tick();
        }, 500)
    };
    manager.onProgress = function(itemUrl, itemsLoaded, itemsTotal) {
        // Update loading bar
        const progressRatio = itemsLoaded / itemsTotal;
        loaderElement.style.transform = `scaleX(${progressRatio})`;
    };
    manager.onError = function(url) {
        console.log('Error loading ' + url);
    };
    
    document.getElementById("startApp").addEventListener("click", () => {
        // Add eventListeners after loading
        document.addEventListener("keydown", onDocumentKeyDown, false);
        document.addEventListener("keyup", onDocumentKeyUp, false);
        // Hide loading screen    
        document.getElementById("loadingScreen").classList.add("fadeOut");
    })
    
    // Debug
    const debugObject = {
        islandColor: '#000f20',
        moonLightColor: '#c3002d'
    };
    let gui,
        stats;
    
    // Control instructions
    document.getElementById("controlsOpen").addEventListener("click", ()=>{
        document.getElementById("controlsPanel").classList.remove("fadeOut");
    })
    document.getElementById("controlsClose").addEventListener("click", ()=>{
        document.getElementById("controlsPanel").classList.add("fadeOut");
    })
    
    /************ Physics ************/
    // World - general
    const world = new CANNON.World();
    world.solver.iterations = 20;
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.gravity.set(0, - 9.82, 0);
    
    // Contacts
    const defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        defaultMaterial,
        {
            friction: 0.1,
            restitution: 0.3
        }
    );
    world.defaultContactMaterial.contactEquationStiffness = 1e6;
    world.defaultContactMaterial.contactEquationRegularizationTime = 3;
    
    const heavyMaterial = new CANNON.Material('heavy');
    const heavyDefaultContactMaterial = new CANNON.ContactMaterial(
        heavyMaterial,
        defaultMaterial,
        {
            friction: 1,
            restitution: 0.0,
            contactEquationRelaxation: 3.75,
        }
    );
    world.addContactMaterial(defaultContactMaterial);
    world.addContactMaterial(heavyDefaultContactMaterial);
    
    /************ Mannequin & animations ************/
    let mixer = null;
    let animationActions = {};
    let mannequin = null;
    let mannequinBody = null;
    
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.load("./models/mannequin/mannequin.glb", model => {
        // Mannequin - MODEL THREE
        mannequin = model.scene;
        // Mannequin animations
        mixer = new THREE.AnimationMixer(mannequin);
        for(const animation of model.animations){
            let animationAction = mixer.clipAction(animation);
            animationActions[animation.name] = animationAction;
            animationActions[animation.name].clampWhenFinished = true;
        }
    
        // Mannequin - PHYSICS BODY
        const mannequinBase = new CANNON.Cylinder(0.6, 0.6, 1, 8);
        const mannequinBottom = new CANNON.Sphere(0.6);
        const mannequinTop = new CANNON.Sphere(0.6);
        mannequinBody = new CANNON.Body({
            mass: 80,
            position: new CANNON.Vec3(0, 1, 0),
            material: heavyMaterial
        });
        mannequinBody.addShape(mannequinBase);
        mannequinBody.addShape(mannequinBottom, new CANNON.Vec3(0, -0.4, 0));
        mannequinBody.addShape(mannequinTop, new CANNON.Vec3(0, 0.4, 0));
        mannequinBody.angularDamping = 1;
        world.addBody(mannequinBody);
        scene.add(mannequin);
    });
    
    /************ Head ************/
    let head;
    const objLoader = new OBJLoader(manager);
    
    objLoader.load("./models/head/head.OBJ", model => {
        // Head - MODEL THREE
        head = model;
        model.children[0].material.color = new THREE.Color("#fff2ff");
        model.scale.set(3, 2.5, 3);
        model.position.set( -12, 3.1, 40);
        model.rotation.reorder('YXZ')
        model.rotation.y = Math.PI * 0.05;
        model.rotation.x = Math.PI * 1.9;
        scene.add(model);
        // Head - PHYSICS BODY
        const headBody = new CANNON.Body();
        headBody.mass = 0;
        headBody.material = defaultMaterial;
        const headShape = new CANNON.Sphere(7);
        const neckShape = new CANNON.Cylinder(6, 5, 3, 12);
        const jawShape = new CANNON.Box(new CANNON.Vec3(5.5, 3, 6));
        headBody.addShape(headShape,  new CANNON.Vec3(-1, 7, -1));
        headBody.addShape(neckShape,  new CANNON.Vec3(-0.2, 0, 3));
        headBody.addShape(jawShape,  new CANNON.Vec3(-0.2, 2, 5),
        quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), - Math.PI / 2 * 0.3 ));
        headBody.position.set(-11.8, 1.2, 37.1);
        world.addBody(headBody);
    });
    
    /************ Computer ************/
    let computer;
    const quaternion = new THREE.Quaternion();
    
    objLoader.load("./models/computer/computer.OBJ", model => {
        // Computer - MODEL THREE
        computer = model;
        model.scale.set(0.1, 0.1, 0.1);
        model.position.set( 22, -0.1, 23);
        scene.add(model);
        // Computer - PHYSICS BODY
        const computerBody = new CANNON.Body();
        computerBody.mass = 0;
        computerBody.material = defaultMaterial;
        const computerBaseShape = new CANNON.Box(new CANNON.Vec3(2.5, 1.5, 1.7));
        const computerStandShape = new CANNON.Box(new CANNON.Vec3(0.7, 0.5, 0.8));
        const computerKeyboardShape = new CANNON.Box(new CANNON.Vec3(2.5, 0.3, 1.2));
        const computerScreenShape = new CANNON.Box(new CANNON.Vec3(2, 1.5, 1.5));
        computerBody.addShape(computerBaseShape);
        computerBody.addShape(computerStandShape, new CANNON.Vec3(0, 2, 0.1));
        computerBody.addShape(computerKeyboardShape, new CANNON.Vec3(0, 0, 2.7),
        quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI / 2 * 0.1 ));
        computerBody.addShape(computerScreenShape, new CANNON.Vec3(0, 4, -0.4));
        computer.rotation.y = - Math.PI * 0.75;
        computerBody.position.set(23 , -0.1, 27.5);
        computerBody.quaternion.copy(computer.quaternion);
        world.addBody(computerBody);
    });
    
    /************ Television ************/
    let television;
    
    objLoader.load("./models/television/television.OBJ", model => {
        // Television - MODEL THREE
        television = model;
        model.scale.set(4, 4, 4);
        model.position.set( 2, -0.1, -20);
        scene.add(model);
        // Television - PHYSICS BODY
        const tvBody = new CANNON.Body();
        tvBody.mass = 0;
        tvBody.position.set(  2, -0.1, -20);
        tvBody.material = defaultMaterial;
        const tvBox = new CANNON.Box(new CANNON.Vec3(2, 1.4, 1));
        const tvLeg = new CANNON.Box(new CANNON.Vec3(0.1, 3.7, 0.1));
        tvBody.addShape(tvBox, new CANNON.Vec3(0, 3.7, 0));
        tvBody.addShape(tvLeg, new CANNON.Vec3(1.5, -0.1, 0.9), quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), -Math.PI / 2 * 0.05 ));
        tvBody.addShape(tvLeg, new CANNON.Vec3(1.5, -0.1, -0.9), quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI / 2 * 0.05 ));
        tvBody.addShape(tvLeg, new CANNON.Vec3(-1.5, -0.1, 0.9), quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), -Math.PI / 2 * 0.05 ));
        tvBody.addShape(tvLeg, new CANNON.Vec3(-1.5, -0.1, -0.9), quaternion.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI / 2 * 0.05 ));
        world.addBody(tvBody);
    });
    
    /************ Moon ************/
    const textureLoader = new THREE.TextureLoader(manager)
    const colorTexture = textureLoader.load('./textures/moon/moon_color.jpg')
    const normalTexture = textureLoader.load('./textures/moon/moon_norm.jpg')
    const moonGeometry = new THREE.SphereGeometry( 12, 32, 32 );
    const moonMaterial = new THREE.MeshStandardMaterial( {map: colorTexture, normalMap: normalTexture, emissive: debugObject.moonLightColor, emissiveIntensity: 0.2 } );
    const moon = new THREE.Mesh( moonGeometry, moonMaterial );
    moon.position.set( 0, 70, 250);
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
        inclination: 0.488,
        azimuth: 0.75
    };
    
    /************ Sea ************/
    // Water
    const waterGeometry = new THREE.PlaneGeometry( 250, 250 );
    let water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: textureLoader.load( './textures/waternormals.jpg', function ( texture ) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            } ),
            alpha: 1.0,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 1.4,
            fog: scene.fog !== undefined
        }
    );
    water.rotation.x = - Math.PI / 2;
    scene.add( water );
    const waterUniforms = water.material.uniforms;
    
    
    /************ Island ************/
    const islandDisplacementTexture = textureLoader.load('./textures/terrain/displacement.png')
    // Island - THREE
    const islandGeometry = new THREE.PlaneGeometry(500, 500, 250, 250);
    const islandMaterial = new THREE.MeshStandardMaterial({color: debugObject.islandColor, displacementMap: islandDisplacementTexture, displacementScale: 100});
    const island = new THREE.Mesh(islandGeometry, islandMaterial);
    island.rotation.x = - Math.PI * 0.5;
    island.position.y = - 20;
    scene.add(island);
    // Island - PHYSICS BODY
    const islandShape = new CANNON.Plane() // infinite plane
    const islandBody = new CANNON.Body()
    islandBody.mass = 0;
    islandBody.quaternion.setFromAxisAngle(new CANNON.Vec3(- 1, 0, 0), Math.PI * 0.5);
    // keep base terrain physic position in the same place por character and elements support
    islandBody.position.y = -0.25;
    islandBody.material = defaultMaterial;
    islandBody.addShape(islandShape);
    world.addBody(islandBody);
    
    /************ Interactive elements ************/
    // Box
    const boxColorTexture = textureLoader.load('./textures/crate/color.jpg')
    const boxOclussionTexture = textureLoader.load('./textures/crate/occlusion.jpg')
    const boxNormalTexture = textureLoader.load('./textures/crate/normal.jpg')
    const boxRoughnessTexture = textureLoader.load('./textures/crate/roughness.jpg')
    
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshStandardMaterial({map: boxColorTexture, normalMap: boxNormalTexture, roughnessMap: boxRoughnessTexture, aoMap: boxOclussionTexture});
    
    let objectsToUpdate = [];
    const createCrate = (width, height, depth, position, rotation, name) => {
        // Crate - Three.js mesh
        const mesh = new THREE.Mesh(boxGeometry, boxMaterial);
        mesh.scale.set(width, height, depth);
        mesh.rotation.y = rotation * Math.PI;
        mesh.castShadow = true;
        mesh.name = name;
        mesh.position.copy(position);
        scene.add(mesh);
    
        // Crate - Cannon.js body
        const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5));
        const body = new CANNON.Body({
            mass: 5,
            position: new CANNON.Vec3(0, 3, 0),
            shape: shape,
            material: defaultMaterial
        });
        body.position.copy(position);
        body.quaternion.copy(mesh.quaternion);
        world.addBody(body);
    
        // Save in objects
        objectsToUpdate.push({ mesh, body });
    }
    
    // Sphere - ball
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    const createSphere = (radius, position, name) => {
        // Ball - Three.js mesh
        const mesh = new THREE.Mesh(sphereGeometry, moonMaterial)
        mesh.scale.set(radius, radius, radius)
        mesh.position.copy(position)
        mesh.name = name;
        scene.add(mesh)
    
        // Ball - Cannon.js body
        const shape = new CANNON.Sphere(radius)
        const body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(0, 3, 0),
            shape: shape,
            material: defaultMaterial
        })
        body.position.copy(position)
        world.addBody(body)
    
        // Save in objects
        objectsToUpdate.push({ mesh, body });
    }
    
    for (let i = 0; i < 30; i++){
        let crateSizeVariation = Math.random() * (1.3 - 1) + 1;
        createCrate(crateSizeVariation, crateSizeVariation, crateSizeVariation, { x: Math.random() * 100 - 50, y:  0.4, z: Math.random() * 100 - 50}, Math.random(), `Crate ${i}` );
        createSphere(Math.random() + 0.2, { x: Math.random() * 100 - 50, y:  0.5, z: Math.random() * 100 - 50}, `Ball ${i}` )
    }
    
    /************ Points ************/
    const points = [
        {
            position: new THREE.Vector3(-12, 3.1, 40), 
            element: document.querySelector("#point-0")
        },
        {
            position: new THREE.Vector3(22, 3, 26.5), 
            element: document.querySelector("#point-1")
        },
        {
            position: new THREE.Vector3( 2, 3, -20), 
            element: document.querySelector("#point-2")
        }
    ]
    
    /************ Lights ************/
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x800000, 5);
    directionalLight.position.set(0, 15, 55);
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x000080, 0.6, 100);
    pointLight.position.set(5, 15, 55);
    scene.add(pointLight);
    
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
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 250);
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
        jump: false
    };
    
    const danceArray = ['macarena', "wave", "swing"];
    let currentDance = null;
    let jumpInitialHeight = null;
    
    function onDocumentKeyDown(event) {
        var keyCode = event.which;
        switch(keyCode) {
            case 16: // shift - run
                if(!modelState.run) {
                    if(modelState.forward) {
                        animationActions.running.weight = 1;
                        animationActions.running.timeScale = 2/1;
                        animationActions.running.play();
                    } 
                }
                modelState.dance = false;
                modelState.run = true;
                break;
            // case 17: // control - crouch / use alternative key for mac
            //     break;
            case 32: // spacebar - jump
                if(mannequin.position.y < 1) {
                    jumpInitialHeight = mannequin.position.y;
                    modelState.jump = true;
                    animationActions.jump.weight = 1;
                    animationActions.jump.timeScale = 0.75/1;
                    animationActions.jump.startAt(2);
                    animationActions.jump.play();
                }
                break;
            case 90: // letter z - dance
                if(!modelState.dance) {
                    let random = Math.floor(Math.random() * danceArray.length);
                    currentDance = danceArray[random];
                    animationActions[currentDance].play();
                    animationActions[currentDance].timeScale = 2/1;
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
                        animationActions.running.timeScale = 2/1;
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
                    orbitControls.maxPolarAngle = Math.PI * 0.5;
                    orbitControls.maxDistance = 30;
                    orbitControls.minDistance = 3;
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
            if(animation == "jump") {
                animationActions[animation].weight -= 0.02;
                return;
            }
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
                mannequinBody.position.x +=  Math.cos(angle) * 0.125;
                mannequinBody.position.z +=  Math.sin(angle) * 0.125;
            } else {
                animationActions.walking.weight = animationActions.walking.weight >= 3 ? 3 : animationActions.walking.weight + 0.2;
                mannequinBody.position.x +=  Math.cos(angle) * 0.075;
                mannequinBody.position.z +=  Math.sin(angle) * 0.075;
            }
        } else {
            goToIdle("walking");
            goToIdle("running");
        }
    
        // jump
        if(modelState.jump){
            animationActions.running.weight = 0;
            animationActions.walking.weight = 0;
            if (mannequinBody.position.y > jumpInitialHeight + 5) {
                modelState.jump = false;
            } else {
                mannequinBody.position.y += 0.25;
            } 
        } else if (animationActions.jump.weight > 0) {
            goToIdle("jump");
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
            mannequinBody.position.x -=  Math.cos(angle) * 0.05;
            mannequinBody.position.z -=  Math.sin(angle) * 0.05;
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
            currentDance = null;
        }
    }
    
    /************ Renderer ************/
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    
    /************ Animate ************/
    const clock = new THREE.Clock();
    let previousTime = 0;
    var frustum = new THREE.Frustum();
    
    const tick = () => {
        const elapsedTime = clock.getElapsedTime();
        const deltaTime = elapsedTime - previousTime;
        previousTime = elapsedTime;
    
        // Update water
        water.material.uniforms[ 'time' ].value += 1.0 / (60.0 * 3);
    
        // Update mannequin
        if(mixer) {
            mixer.update(deltaTime);
            // Model update
            updateMannequin();
        }
    
        // Update mannequin physics & camera
        if(mannequin) {
            // Update physics
            world.step(1 / 60, deltaTime, 3);
            mannequin.position.set(mannequinBody.position.x, mannequinBody.position.y - 1.0, mannequinBody.position.z);
            // Update camera
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
    
        // Update crates and balls physics 
        for(const object of objectsToUpdate) {
            object.mesh.position.copy(object.body.position);
            object.mesh.quaternion.copy(object.body.quaternion);
        }
    
        // Update stats
        if (DEBUG) {
            stats.update();
        }
    
        // Move points
        for(const point of points) {
            const screenPosition = point.position.clone();
            frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));  
            if (frustum.containsPoint(screenPosition)) {
                point.element.classList.add('visible');
            } else {
                point.element.classList.remove('visible');
            }
            screenPosition.project(camera);
            const translateX = screenPosition.x * sizes.width * 0.5;
            const translateY = - screenPosition.y * sizes.height * 0.5;
            point.element.style.transform = `translate(${translateX}px, ${translateY}px)`;
        }
    
        // Render
        renderer.render(scene, camera);
        // effectComposer.render()
    
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
    
    /************ debug ************/
    if (DEBUG) {
        gui = new dat.GUI();
        stats = Stats();
        document.body.appendChild(stats.dom);
        cannonDebugger(scene, world.bodies);
    
        const folderMoon = gui.addFolder( 'Moon' );
        folderMoon.add( moonMaterial, 'emissiveIntensity', 0, 5, 0.1 );
        folderMoon.addColor(debugObject, 'moonLightColor').onChange(() => {moonMaterial.emissive.set(debugObject.moonLightColor)});
        folderMoon.add( moon.position, 'x', -100, 100, 0.1 );
        folderMoon.add( moon.position, 'y', -100, 100, 0.1 );
        folderMoon.add( moon.position, 'z', -100, 100, 0.1 );
    
        const folderSky = gui.addFolder( 'Sky' );
        folderSky.add( parameters, 'inclination', 0, 0.5, 0.0001 ).onChange( updateSun );
        folderSky.add( parameters, 'azimuth', 0, 1, 0.0001 ).onChange( updateSun );
    
        const folderWater = gui.addFolder( 'Water' );
        folderWater.add( waterUniforms.distortionScale, 'value', 0, 8, 0.1 ).name( 'distortionScale' );
        folderWater.add( waterUniforms.size, 'value', 0.1, 10, 0.1 ).name( 'size' );
        folderWater.add( waterUniforms.alpha, 'value', 0.9, 1, .001 ).name( 'alpha' );
    
        const terrainFolder = gui.addFolder("Terrain");
        terrainFolder.add(island.position, 'y').step(0.1).min(-50).max(50);
        terrainFolder.add(island.material, 'displacementScale').step(0.1).min(-100).max(200);
        terrainFolder.addColor(debugObject, 'islandColor').onChange(() => {islandMaterial.color.set(debugObject.islandColor)});
    
        const lightsFolder = gui.addFolder("Lights");
        lightsFolder.add(directionalLight, 'intensity').step(0.1).min(0);
        lightsFolder.add(pointLight, 'intensity').step(0.1).min(0);
    }
}

if (typeof window.orientation !== 'undefined') { 
    document.getElementById("supported").classList.add("hidden");
    document.getElementById("mobileNotSupported").classList.remove("hidden");
} else {
    main();
}