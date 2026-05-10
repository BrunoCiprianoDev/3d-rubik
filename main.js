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
scene.background = new THREE.Color(0x1F1D1D);

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

// // --- EVENTO DE TECLADO ---

// window.addEventListener('keydown', (event) => {

//     // Eixo Y (Camadas Horizontais)
//     const topCubies = cubies.filter(c => c.current_position.y === 0);      // Superior (Cima)
//     const midHorizCubies = cubies.filter(c => c.current_position.y === -1); // Meio Horizontal
//     const bottomCubies = cubies.filter(c => c.current_position.y === 1);     // Inferior (Baixo)

//     // Eixo X (Camadas Verticais Laterais)
//     const rightCubies = cubies.filter(c => c.current_position.x === 0);      // Direita
//     const midVertLatCubies = cubies.filter(c => c.current_position.x === -1); // Meio Vertical (Lateral)
//     const leftCubies = cubies.filter(c => c.current_position.x === 1);     // Esquerda

//     // Eixo Z (Camadas de Profundidade)
//     const frontCubies = cubies.filter(c => c.current_position.z === 0);      // Frontal (Frente)
//     const midDepthCubies = cubies.filter(c => c.current_position.z === -1);  // Meio Vertical (Profundidade)
//     const backCubies = cubies.filter(c => c.current_position.z === 1);     // Traseira (Trás)


//     if (isRotating) return;

//     if (event.key === "1") {
//         rotateLayer(topCubies, true, 'y');
//     }

//     if (event.key === "2") {
//         rotateLayer(midHorizCubies, true, 'y');
//     }

//     if (event.key === "3") {
//         rotateLayer(bottomCubies, true, 'y');
//     }

//     if (event.key === "4") {
//         rotateLayer(rightCubies, true, 'x');
//     }

//     if (event.key === "5") {
//         rotateLayer(midVertLatCubies, true, 'x');
//     }

//     if (event.key === "6") {
//         rotateLayer(leftCubies, true, 'x');
//     }

//     if (event.key === "7") {
//         rotateLayer(frontCubies, true, 'z');
//     }

//     if (event.key === "8") {
//         rotateLayer(midDepthCubies, true, 'z');
//     }

//     if (event.key === "9") {
//         rotateLayer(backCubies, true, 'z');
//     }

// });


// let selectedPiece = null;
// let dragDirection = ""; // Armazena "horizontal" ou "vertical"
// let dragIntensity = 0;  // Armazena o valor bruto (positivo ou negativo) para definir o sentido
// let mouseDownPos = new THREE.Vector2()
// // --- No seu ouvinte de 'mousedown' ---
// window.addEventListener('mousedown', (event) => { // Limpa a peça selecionada no início do clique
//     //Temporaria
//     const top_2 = cubies.filter(c => c.current_position.y === 0);      // Superior (Cima)
//     const top_3 = cubies.filter(c => c.current_position.y === -1); // Meio Horizontal
//     const top_1 = cubies.filter(c => c.current_position.y === 1);     // Inferior (Baixo)

//     // Eixo X (Camadas Verticais Laterais)
//     const right_2 = cubies.filter(c => c.current_position.x === 0);      // Direita
//     const right_3 = cubies.filter(c => c.current_position.x === -1); // Meio Vertical (Lateral)
//     const right_1 = cubies.filter(c => c.current_position.x === 1);     // Esquerda

//     // Eixo Z (Camadas de Profundidade)
//     const front_2 = cubies.filter(c => c.current_position.z === 0);      // Frontal (Frente)
//     const front_3 = cubies.filter(c => c.current_position.z === -1);  // Meio Vertical (Profundidade)
//     const front_1 = cubies.filter(c => c.current_position.z === 1);     // Traseira (Trás)

//     const clickNormal = new THREE.Vector3();
//     let mouseDownPos = new THREE.Vector2();

//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, camera);

//     const intersects = raycaster.intersectObjects(cubies.map(c => c.model), true);

//     if (intersects.length > 0) {
//         const intersection = intersects[0];
//         const hitMesh = intersection.object;

//         const localNormal = intersection.face.normal;
//         const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
//         const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

//         const faceDirection = {
//             x: Math.round(worldNormal.x),
//             y: Math.round(worldNormal.y),
//             z: Math.round(worldNormal.z)
//         };

//         // ================================================================
//         // NOVO: IDENTIFICAR O NOME DA FACE
//         // ================================================================


//         // Guardar para uso posterior
//         // clickNormal.copy(worldNormal); 

//         // --- Resto da sua lógica de identificação da Piece ---
//         let currentObject = hitMesh;
//         while (currentObject.parent && !cubies.find(c => c.model === currentObject)) {
//             currentObject = currentObject.parent;
//         }

//         selectedPiece = cubies.find(c => c.model === currentObject);

//         if (selectedPiece) {
//             // console.log("Peça selecionada:", selectedPiece);
//             isDragging = true;
//             mouseDownPos.set(event.clientX, event.clientY);
//             controls.enabled = false;
//         }

//         let faceName = "";
//         let rotationAxis = null;
//         let piece_x = selectedPiece.current_position.x;
//         let piece_y = selectedPiece.current_position.y;
//         let piece_z = selectedPiece.current_position.z;

//         console.log("Posição da peça selecionada:", selectedPiece.current_position);

//         if (faceDirection.x === 1) {
//             faceName = "Direita (Right)"
//             rotationAxis = 'x';
//             if (piece_x === 1 && piece_z === 1) {
//                 rotateLayer(front_1, true, 'z');
//             }
//             if (piece_x === 1 && piece_z === 0) {
//                 rotateLayer(front_2, true, 'z');
//             }
//             if (piece_x === 1 && piece_z === -1) {
//                 rotateLayer(front_3, true, 'z');
//             }

//         } else if (faceDirection.x === -1) {
//             faceName = "Esquerda (Left)";
//             rotationAxis = 'x';
//             if (piece_x === -1 && piece_z === 1) {
//                 rotateLayer(front_1, false, 'z');
//             }
//             if (piece_x === -1 && piece_z === 0) {
//                 rotateLayer(front_2, false, 'z');
//             }
//             if (piece_x === -1 && piece_z === -1) {
//                 rotateLayer(front_3, false, 'z');
//             }
//         } 


//          if (faceDirection.z === 1) {
//             faceName = "Fronte (front)";
//             rotationAxis = 'z';
//             if (piece_x === 1 && piece_z === 1) {
//                 rotateLayer(right_1, false, 'x');
//             }
//             if (piece_x === 0 && piece_z === 1) {
//                 rotateLayer(right_2, false, 'x');
//             }
//             if (piece_x === -1 && piece_z === 1) {
//                 rotateLayer(right_3, false, 'x');
//             }
//         } else if (faceDirection.z === -1) {
//             faceName = "Frente (front)";
//             rotationAxis = 'z';
//             if (piece_x === 1 && piece_z === -1) {
//                 rotateLayer(right_1, false, 'x');
//             }
//             if (piece_x === 0 && piece_z === -1) {
//                 rotateLayer(right_2, false, 'x');
//             }
//             if (piece_x === -1 && piece_z === -1) {
//                 rotateLayer(right_3, false, 'x');
//             }
//         }

//         if (faceDirection.y === 1) {
//             faceName = "Topo (Up)";
//             rotationAxis = 'y';
//             if (piece_y === 1 && piece_z === 1) {
//                 rotateLayer(top_1, false, 'y');
//             }
//             if (piece_y === 1 && piece_z === 0) {
//                 rotateLayer(top_2, false, 'y');
//             }
//             if (piece_y === 1 && piece_z === -1) {
//                 rotateLayer(top_3, false, 'y');
//             }
//         }
//         //console.log("=== Impacto Detectado ===");
//         //console.log("Face identificada:", faceName);
//         console.log("Eixo dominante:", faceDirection);


//     }
// });

// // --- 3. O EVENTO PARA SOLTAR (mouseup) ---
// window.addEventListener('mouseup', () => {
//     // Quando solta o mouse, independente de ter girado ou não:
//     isDragging = false;
//     selectedPiece = null;

//     // REATIVA a rotação da câmera
//     controls.enabled = true;
//     console.log("Câmera liberada");
// });

let selectedPiece = null;
let dragDirection = ""; // Armazena "horizontal" ou "vertical"
let dragIntensity = 0;  // Armazena o valor bruto (positivo ou negativo) para definir o sentido
let mouseDownPos = new THREE.Vector2();
let faceDirection = null;

// --- No seu ouvinte de 'mousedown' ---
window.addEventListener('mousedown', (event) => {

    const clickNormal = new THREE.Vector3();
    // REMOVIDO: let mouseDownPos = ... (usaremos a global para não quebrar o escopo)

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubies.map(c => c.model), true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const hitMesh = intersection.object;

        const localNormal = intersection.face.normal;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
        const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

        faceDirection = {
            x: Math.round(worldNormal.x),
            y: Math.round(worldNormal.y),
            z: Math.round(worldNormal.z)
        };

        let currentObject = hitMesh;
        while (currentObject.parent && !cubies.find(c => c.model === currentObject)) {
            currentObject = currentObject.parent;
        }

        selectedPiece = cubies.find(c => c.model === currentObject);

        if (selectedPiece) {
            isDragging = true;
            // ARMAZENA A POSIÇÃO INICIAL NA VARIÁVEL GLOBAL
            mouseDownPos.set(event.clientX, event.clientY);
            controls.enabled = false;
        };

    }
});

// --- 3. EVENTO PARA SOLTAR (mouseup) MODIFICADO ---
window.addEventListener('mouseup', (event) => {

    const top_2 = cubies.filter(c => c.current_position.y === 0);
    const top_3 = cubies.filter(c => c.current_position.y === -1);
    const top_1 = cubies.filter(c => c.current_position.y === 1);

    const right_2 = cubies.filter(c => c.current_position.x === 0);
    const right_3 = cubies.filter(c => c.current_position.x === -1);
    const right_1 = cubies.filter(c => c.current_position.x === 1);

    const front_2 = cubies.filter(c => c.current_position.z === 0);
    const front_3 = cubies.filter(c => c.current_position.z === -1);
    const front_1 = cubies.filter(c => c.current_position.z === 1);

    if (isDragging && selectedPiece) {
        // CALCULA O DESLOCAMENTO
        const deltaX = event.clientX - mouseDownPos.x;
        const deltaY = event.clientY - mouseDownPos.y;

        // ARMAZENA O SENTIDO (Qual eixo teve maior movimento)
        dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";

        // ARMAZENA POSITIVO OU NEGATIVO (Intensidade)
        // No navegador, deltaY negativo significa que o mouse subiu.
        dragIntensity = (dragDirection === "horizontal") ? deltaX : -deltaY;

        console.log(`Sentido: ${dragDirection}, Direção: ${dragIntensity}`);
    }

    isDragging = false;

    let faceName = "";

    let rotationAxis = null;
    let piece_x = selectedPiece.current_position.x;
    let piece_y = selectedPiece.current_position.y;
    let piece_z = selectedPiece.current_position.z;

    if (faceDirection.x === 1) {
        faceName = "Direita (Right)"
        rotationAxis = 'x';
        if (piece_x === 1 && piece_z === 1) {
            rotateLayer(front_1, true, 'z');
        }
        if (piece_x === 1 && piece_z === 0) {
            rotateLayer(front_2, true, 'z');
        }
        if (piece_x === 1 && piece_z === -1) {
            rotateLayer(front_3, true, 'z');
        }

    }

        controls.enabled = true;
        console.log("Câmera liberada");
        console.log("Face direction:", faceDirection);
        console.log("Posição da peça selecionada:", selectedPiece.current_position);

        selectedPiece = null;
    });

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();