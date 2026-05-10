import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CLASSE DA PEÇA ---
export class Piece {
    constructor(model, x, y, z) {
        this.model = model;
        this.initial_position = { x, y, z };
        this.current_position = { x, y, z };
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

});

// --- FUNÇÕES DE ROTAÇÃO MANUAL (TECLADO) ---

function rotateLayer(layerCubies, clockwise = true, axis) {
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
            pivot.rotation[axis] = targetRad;
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

                // Atualiza a posição atual da peça com base na posição do modelo
                c.current_position.x = Math.round(c.model.position.x / offset);
                c.current_position.y = Math.round(c.model.position.y / offset);
                c.current_position.z = Math.round(c.model.position.z / offset);
            });

            isRotating = false;
        } else {
            pivot.rotation[axis] += speed;
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// --- EVENTO DE TECLADO ---

window.addEventListener('keydown', (event) => {

    // Eixo Y (Camadas Horizontais)
    const topCubies = cubies.filter(c => c.current_position.y === 0);      // Superior (Cima)
    const midHorizCubies = cubies.filter(c => c.current_position.y === -1); // Meio Horizontal
    const bottomCubies = cubies.filter(c => c.current_position.y === 1);     // Inferior (Baixo)

    // Eixo X (Camadas Verticais Laterais)
    const rightCubies = cubies.filter(c => c.current_position.x === 0);      // Direita
    const midVertLatCubies = cubies.filter(c => c.current_position.x === -1); // Meio Vertical (Lateral)
    const leftCubies = cubies.filter(c => c.current_position.x === 1);     // Esquerda

    // Eixo Z (Camadas de Profundidade)
    const frontCubies = cubies.filter(c => c.current_position.z === 0);      // Frontal (Frente)
    const midDepthCubies = cubies.filter(c => c.current_position.z === -1);  // Meio Vertical (Profundidade)
    const backCubies = cubies.filter(c => c.current_position.z === 1);     // Traseira (Trás)


    if (isRotating) return;

    if (event.key === "1") {
        rotateLayer(topCubies, true, 'y');
    }

    if (event.key === "2") {
        rotateLayer(midHorizCubies, true, 'y');
    }

    if (event.key === "3") {
        rotateLayer(bottomCubies, true, 'y');
    }

    if (event.key === "4") {
        rotateLayer(rightCubies, true, 'x');
    }

    if (event.key === "5") {
        rotateLayer(midVertLatCubies, true, 'x');
    }

    if (event.key === "6") {
        rotateLayer(leftCubies, true, 'x');
    }

});


// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();