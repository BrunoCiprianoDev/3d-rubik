import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CLASSE DA PEÇA ---
export class Piece {
    constructor(model, x, y, z) {
        this.model = model;
        this.initial_position = { x, y, z };
    }
}

// --- CONFIGURAÇÃO DA CENA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 10);

const canvas = document.querySelector('#three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);

// --- ILUMINAÇÃO ---
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// --- ESTADOS E VARIÁVEIS DO JOGO ---
const cubies = [];
let isRotating = false;
let isDragging = false;
let selectedCubie = null;
let clickNormal = null;
let startMousePos = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let offset = 0; // Será definido após o carregamento

// Pivot central para rotações de camada
const pivot = new THREE.Object3D();
scene.add(pivot);

// --- CARREGAMENTO DO MODELO ---
const loader = new GLTFLoader();
loader.load('model.glb', (gltf) => {
    const baseModel = gltf.scene;
    const bbox = new THREE.Box3().setFromObject(baseModel);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const pieceSize = size.x;
    const margin = -0.05;
    offset = pieceSize + margin;

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue;

                const modelClone = baseModel.clone();
                modelClone.position.set(x * offset, y * offset, z * offset);

                const piece = new Piece(modelClone, x, y, z);
                scene.add(piece.model);
                cubies.push(piece);
            }
        }
    }

        console.log(cubies.filter(c => c.model.position.y < -offset / 2));
});

// --- LÓGICA DE ROTAÇÃO E INTERAÇÃO ---

function handleRotation(delta) {
    if (isRotating || !selectedCubie) return;
    isRotating = true;

    // 1. Determina a direção do movimento do mouse
    const moveAxis = Math.abs(delta.x) > Math.abs(delta.y) ? 'x' : 'y';

    // 2. Decide qual eixo do cubo rotacionar baseado na face clicada (normal)
    let rotationAxis = new THREE.Vector3();
    let positionKey = '';

    // Simplificação da lógica de projeção de movimento
    if (Math.abs(clickNormal.z) > 0.5) {
        if (moveAxis === 'x') { rotationAxis.set(0, 1, 0); positionKey = 'y'; }
        else { rotationAxis.set(1, 0, 0); positionKey = 'x'; }
    } else if (Math.abs(clickNormal.x) > 0.5) {
        if (moveAxis === 'x') { rotationAxis.set(0, 1, 0); positionKey = 'y'; }
        else { rotationAxis.set(0, 0, 1); positionKey = 'z'; }
    } else {
        if (moveAxis === 'x') { rotationAxis.set(0, 0, 1); positionKey = 'z'; }
        else { rotationAxis.set(1, 0, 0); positionKey = 'x'; }
    }

    // 3. Captura os cubos da camada
    const targetValue = selectedCubie.position[positionKey];
    const layerCubies = cubies.filter(c => Math.abs(c.model.position[positionKey] - targetValue) < 0.1);

    // 4. Prepara o Pivot
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();
    layerCubies.forEach(c => pivot.attach(c.model));

    // 5. Animação da rotação (90 graus)
    const direction = (moveAxis === 'x' ? delta.x : -delta.y) > 0 ? 1 : -1;
    const targetRad = (Math.PI / 2) * direction;
    let currentRad = 0;
    const step = 0.1 * direction;

    function animateLayer() {
        currentRad += step;
        if (Math.abs(currentRad) >= Math.PI / 2) {
            // Finaliza rotação exata
            if (rotationAxis.x) pivot.rotation.x = targetRad;
            if (rotationAxis.y) pivot.rotation.y = targetRad;
            if (rotationAxis.z) pivot.rotation.z = targetRad;
            pivot.updateMatrixWorld();

            // Devolve para a cena e limpa imprecisões matemáticas
            layerCubies.forEach(c => {
                scene.attach(c.model);
                c.model.position.x = Math.round(c.model.position.x / offset) * offset;
                c.model.position.y = Math.round(c.model.position.y / offset) * offset;
                c.model.position.z = Math.round(c.model.position.z / offset) * offset;
            });

            isRotating = false;
        } else {
            if (rotationAxis.x) pivot.rotation.x += step;
            if (rotationAxis.y) pivot.rotation.y += step;
            if (rotationAxis.z) pivot.rotation.z += step;
            requestAnimationFrame(animateLayer);
        }
    }
    animateLayer();
}

// --- FUNÇÕES DE ROTAÇÃO MANUAL (TECLADO) ---
 


function rotateLayer(layerCubies, clockwise = true) {
    if (isRotating || offset === 0) return;
    isRotating = true;

    // 2. SETUP PIVOT
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();
    layerCubies.forEach(c => pivot.attach(c.model));

    // 3. DEFINIÇÃO DE SENTIDO
    // Se clockwise for true, gira -90 graus. Se false (anti-horário), gira 90 graus.
    const direction = clockwise ? -1 : 1;
    const targetRad = (Math.PI / 2) * direction;
    const speed = 0.05 * direction;
    let currentRad = 0;

    function animate() {
        currentRad += speed;

        // Usamos Math.abs para a condição de parada funcionar em ambos os sentidos
        if (Math.abs(currentRad) >= Math.PI / 2) {
            pivot.rotation.y = targetRad;
            pivot.updateMatrixWorld();

            // 4. LIMPEZA E ARREDONDAMENTO
            layerCubies.forEach(c => {
                scene.attach(c.model);

                // Mantém as peças perfeitamente alinhadas na grade
                c.model.position.set(
                    Math.round(c.model.position.x / offset) * offset,
                    Math.round(c.model.position.y / offset) * offset,
                    Math.round(c.model.position.z / offset) * offset
                );

                // Corrige a rotação para o ângulo reto mais próximo
                c.model.rotation.set(
                    Math.round(c.model.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.model.rotation.y / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.model.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
                );
            });

            isRotating = false;
        } else {
            pivot.rotation.y += speed;
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// --- EVENTO DE TECLADO ---

window.addEventListener('keydown', (event) => {

    // Eixo Y (Camadas Horizontais)
    const topCubies = cubies.filter(c => c.model.position.y > offset / 2);      // Superior (Cima)
    const midHorizCubies = cubies.filter(c => Math.abs(c.model.position.y) < offset / 2); // Meio Horizontal
    const bottomCubies = cubies.filter(c => c.model.position.y < -offset / 2);      // Inferior (Baixo)

    // Eixo X (Camadas Verticais Laterais)
    const rightCubies = cubies.filter(c => c.model.position.x < offset / 2);      // Direita
    const midVertLatCubies = cubies.filter(c => Math.abs(c.model.position.x) < offset / 2); // Meio Vertical (Lateral)
    const leftCubies = cubies.filter(c => c.model.position.x > -offset / 2);      // Esquerda

    // Eixo Z (Camadas de Profundidade)
    const frontCubies = cubies.filter(c => c.model.position.z > offset / 2);      // Frontal (Frente)
    const midDepthCubies = cubies.filter(c => Math.abs(c.model.position.z) < offset / 2); // Meio Vertical (Profundidade)
    const backCubies = cubies.filter(c => c.model.position.z < -offset / 2);      // Traseira (Trás)


    if (isRotating) return;

    if (event.key === "ArrowDown") {
        console.log("Seta para baixo: Camada Inferior (Horário)");
        rotateLayer(bottomCubies, true);
    }

    if (event.key === "ArrowUp") {
        console.log("Seta para cima: Camada Inferior (Anti-horário)");
        rotateLayer(topCubies, false);
    }
});

// --- EVENTOS DE MOUSE ---

window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubies.map(c => c.model));

    if (intersects.length > 0 && !isRotating) {
        isDragging = true;
        selectedCubie = intersects[0].object;
        // Pega a normal da face e converte para o espaço do mundo
        clickNormal = intersects[0].face.normal.clone().applyQuaternion(selectedCubie.quaternion);
        startMousePos.set(e.clientX, e.clientY);
        controls.enabled = false;
    }
});

window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        const delta = new THREE.Vector2(e.clientX - startMousePos.x, e.clientY - startMousePos.y);
        if (delta.length() > 10) handleRotation(delta);
    }
    isDragging = false;
    controls.enabled = true;
});

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();