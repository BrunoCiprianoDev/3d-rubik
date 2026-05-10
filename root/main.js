import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

//=======================================================
// --- LÓGICA DE JOGO E MANIPULAÇÃO DAS PEÇAS ---
//=======================================================

// --- CLASSE PARA REPRESENTAR CADA PEÇA DO CUBO ---
export class Piece {
    constructor(model, x, y, z) {
        this.model = model;
        this.initial_position = { x, y, z };
        this.current_position = { x, y, z };
    }
}

let isSolved = false;

// --- ESTADOS E VARIÁVEIS DO JOGO ---
let moveCount = -1; // Contador de movimentos, inicia em -1 para não contar o shuffle inicial
const cubies = [];
let isRotating = false;
let isDragging = false;
let selectedCubie = null;
let clickNormal = null;
let startMousePos = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let offset = 0; // Distância entre as peças

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

// --- COMPORTAMENTO DE ROTAÇÃO DAS CAMADAS ---

function rotateLayer(layerCubies, clockwise = true, axis) {

    if (checkSolved()) {
        return;
    }

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

let selectedPiece = null;
let dragDirection = ""; // Armazena "horizontal" ou "vertical"
let dragOrientation = 0;  // Armazena o valor bruto (positivo ou negativo) para definir o sentido
let mouseDownPos = new THREE.Vector2();
let faceDirection = null;

// --- No seu ouvinte de 'mousedown' ---
window.addEventListener('mousedown', (event) => {

    const clickNormal = new THREE.Vector3();

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

// --- FUNÇÕES PARA OBTER AS PEÇAS DE CADA CAMADA ---
function get_cubies_top_1() {
    return cubies.filter(c => c.current_position.y === 1);
}

function get_cubies_top_2() {
    return cubies.filter(c => c.current_position.y === 0);
}

function get_cubies_top_3() {
    return cubies.filter(c => c.current_position.y === -1);
}

function get_cubies_right_1() {
    return cubies.filter(c => c.current_position.x === 1);
}

function get_cubies_right_2() {
    return cubies.filter(c => c.current_position.x === 0);
}

function get_cubies_right_3() {
    return cubies.filter(c => c.current_position.x === -1);
}

function get_cubies_front_1() {
    return cubies.filter(c => c.current_position.z === 1);
}

function get_cubies_front_2() {
    return cubies.filter(c => c.current_position.z === 0);
}

function get_cubies_front_3() {
    return cubies.filter(c => c.current_position.z === -1);
}

// --- 3. EVENTO PARA SOLTAR (mouseup) MODIFICADO ---
window.addEventListener('mouseup', (event) => {

    if (isDragging && selectedPiece) {
        // CALCULA O DESLOCAMENTO
        const deltaX = event.clientX - mouseDownPos.x;
        const deltaY = event.clientY - mouseDownPos.y;

        // ARMAZENA O SENTIDO (Qual eixo teve maior movimento)
        dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";

        // ARMAZENA POSITIVO OU NEGATIVO (Intensidade)
        // No navegador, deltaY negativo significa que o mouse subiu.
        dragOrientation = (dragDirection === "horizontal") ? deltaX : -deltaY;

        console.log(`Sentido: ${dragDirection}, Direção: ${dragOrientation}`);
    }

    isDragging = false;

    let faceName = "";

    let rotationAxis = null;
    let piece_x = selectedPiece.current_position.x;
    let piece_y = selectedPiece.current_position.y;
    let piece_z = selectedPiece.current_position.z;

    // Define se a rotação será no sentido horário ou anti-horário com base na direção do arrasto
    let rotationOrientation = dragOrientation > 0 ? false : true;

    // --------- LÓGICA DE ROTAÇÃO BASEADA NA FACE SELECIONADA E DIREÇÃO DO ARRASTO ---------

    // Eixo vertical (arrasto para cima ou para baixo)
    if (dragDirection === "vertical") {
        ++moveCount;
        if (faceDirection.x === 1) {
            faceName = "Direita (v01)"
            rotationAxis = 'x';
            if (piece_x === 1 && piece_z === 1) {
                rotateLayer(get_cubies_front_1(), rotationOrientation, 'z');
            }
            if (piece_x === 1 && piece_z === 0) {
                rotateLayer(get_cubies_front_2(), rotationOrientation, 'z');
            }
            if (piece_x === 1 && piece_z === -1) {
                rotateLayer(get_cubies_front_3(), rotationOrientation, 'z');
            }
        } else if (faceDirection.x === -1) {
            rotationOrientation = !rotationOrientation; // Inverte o sentido para a face oposta
            faceName = "Esquerda (v01)";
            rotationAxis = 'x';
            if (piece_x === -1 && piece_z === 1) {
                rotateLayer(get_cubies_front_1(), rotationOrientation, 'z');
            }
            if (piece_x === -1 && piece_z === 0) {
                rotateLayer(get_cubies_front_2(), rotationOrientation, 'z');
            }
            if (piece_x === -1 && piece_z === -1) {
                rotateLayer(get_cubies_front_3(), rotationOrientation, 'z');
            }
        } else if (faceDirection.y === 1) {
            rotationOrientation = !rotationOrientation;
            faceName = "Topo (v01)";
            rotationAxis = 'y';
            if (piece_y === 1 && piece_x === 1) {
                rotateLayer(get_cubies_right_1(), rotationOrientation, 'x');
            }
            if (piece_y === 1 && piece_x === 0) {
                rotateLayer(get_cubies_right_2(), rotationOrientation, 'x');
            }
            if (piece_y === 1 && piece_x === -1) {
                rotateLayer(get_cubies_right_3(), rotationOrientation, 'x');
            }
        } else if (faceDirection.y === -1) {
            rotationOrientation = !rotationOrientation;
            faceName = "Topo (v02)";
            rotationAxis = 'y';
            if (piece_y === -1 && piece_x === 1) {
                rotateLayer(get_cubies_right_1(), rotationOrientation, 'x');
            }
            if (piece_y === -1 && piece_x === 0) {
                rotateLayer(get_cubies_right_2(), rotationOrientation, 'x');
            }
            if (piece_y === -1 && piece_x === -1) {
                rotateLayer(get_cubies_right_3(), rotationOrientation, 'x');
            }
        } else if (faceDirection.z === 1) {
            rotationOrientation = !rotationOrientation;
            faceName = "Frente (v02)";
            rotationAxis = 'z';
            if (piece_x === 1 && piece_z === 1) {
                rotateLayer(get_cubies_right_1(), rotationOrientation, 'x');
            }
            if (piece_x === 0 && piece_z === 1) {
                rotateLayer(get_cubies_right_2(), rotationOrientation, 'x');
            }
            if (piece_x === -1 && piece_z === 1) {
                rotateLayer(get_cubies_right_3(), rotationOrientation, 'x');
            }
        } else if (faceDirection.z === -1) {
            faceName = "Frente (v02)";
            rotationAxis = 'z';
            if (piece_x === 1 && piece_z === -1) {
                rotateLayer(get_cubies_right_1(), rotationOrientation, 'x');
            }
            if (piece_x === 0 && piece_z === -1) {
                rotateLayer(get_cubies_right_2(), rotationOrientation, 'x');
            }
            if (piece_x === -1 && piece_z === -1) {
                rotateLayer(get_cubies_right_3(), rotationOrientation, 'x');
            }
        }
        // eixo horizontal (arrasto para esquerda ou direita)
    } else if (dragDirection === "horizontal") {
        ++moveCount;
        if (faceDirection.x === 1) {
            faceName = "Direita (h01)"
            rotationAxis = 'x';
            if (piece_x === 1 && piece_y === 1) {
                rotateLayer(get_cubies_top_1(), rotationOrientation, 'y');
            }
            if (piece_x === 1 && piece_y === 0) {
                rotateLayer(get_cubies_top_2(), rotationOrientation, 'y');
            }
            if (piece_x === 1 && piece_y === -1) {
                rotateLayer(get_cubies_top_3(), rotationOrientation, 'y');
            }
        } else if (faceDirection.x === -1) {
            faceName = "Direita (h02)"
            rotationAxis = 'x';
            if (piece_x === -1 && piece_y === 1) {
                rotateLayer(get_cubies_top_1(), rotationOrientation, 'y');
            }
            if (piece_x === -1 && piece_y === 0) {
                rotateLayer(get_cubies_top_2(), rotationOrientation, 'y');
            }
            if (piece_x === -1 && piece_y === -1) {
                rotateLayer(get_cubies_top_3(), rotationOrientation, 'y');
            }
        } else if (faceDirection.y === 1) {
            rotationOrientation = !rotationOrientation;
            faceName = "Topo (h01)";
            rotationAxis = 'y';
            if (piece_y === 1 && piece_z === 1) {
                rotateLayer(get_cubies_front_1(), rotationOrientation, 'z');
            }
            if (piece_y === 1 && piece_z === 0) {
                rotateLayer(get_cubies_front_2(), rotationOrientation, 'z');
            }
            if (piece_y === 1 && piece_z === -1) {
                rotateLayer(get_cubies_front_3(), rotationOrientation, 'z');
            }
        } else if (faceDirection.y === -1) {
            faceName = "Topo (h02)";
            rotationAxis = 'y';
            if (piece_y === -1 && piece_z === 1) {
                rotateLayer(get_cubies_front_1(), rotationOrientation, 'z');
            }
            if (piece_y === -1 && piece_z === 0) {
                rotateLayer(get_cubies_front_2(), rotationOrientation, 'z');
            }
            if (piece_y === -1 && piece_z === -1) {
                rotateLayer(get_cubies_front_3(), rotationOrientation, 'z');
            }
        } else if (faceDirection.z === 1) {
            faceName = "Frente (h01)";
            rotationAxis = 'z';
            if (piece_z === 1 && piece_y === 1) {
                rotateLayer(get_cubies_top_1(), rotationOrientation, 'y');
            }
            if (piece_z === 1 && piece_y === 0) {
                rotateLayer(get_cubies_top_2(), rotationOrientation, 'y');
            }
            if (piece_z === 1 && piece_y === -1) {
                rotateLayer(get_cubies_top_3(), rotationOrientation, 'y');
            }
        } else if (faceDirection.z === -1) {
            faceName = "Frente (h02)";
            rotationAxis = 'z';
            if (piece_z === -1 && piece_y === 1) {
                rotateLayer(get_cubies_top_1(), rotationOrientation, 'y');
            }
            if (piece_z === -1 && piece_y === 0) {
                rotateLayer(get_cubies_top_2(), rotationOrientation, 'y');
            }
            if (piece_z === -1 && piece_y === -1) {
                rotateLayer(get_cubies_top_3(), rotationOrientation, 'y');
            }
        }
    }

    // Reativa os controles de órbita após a rotação
    controls.enabled = true;
    // Debug:
    console.log(faceName);
    console.log("Face direction:", faceDirection);
    console.log("Posição da peça selecionada:", selectedPiece.current_position);

});

function shuffleCube(moves = 20) {
    if (isRotating) return; // Não embaralha se já estiver girando

    let count = 0;

    // Desativamos temporariamente o checkSolved para não dar alerta durante o shuffle
    const tempCheckSolved = checkSolved;
    window.checkSolved = () => false;

    const axes = ['x', 'y', 'z'];
    const layers = [-1, 0, 1];

    const interval = setInterval(() => {
        const randomAxis = axes[Math.floor(Math.random() * axes.length)];
        const randomLayerIndex = layers[Math.floor(Math.random() * layers.length)];
        const randomDirection = Math.random() > 0.5;

        // Seleciona as peças da camada baseada no eixo sorteado
        let layerToRotate;
        if (randomAxis === 'x') {
            layerToRotate = cubies.filter(c => c.current_position.x === randomLayerIndex);
        } else if (randomAxis === 'y') {
            layerToRotate = cubies.filter(c => c.current_position.y === randomLayerIndex);
        } else {
            layerToRotate = cubies.filter(c => c.current_position.z === randomLayerIndex);
        }

        rotateLayer(layerToRotate, randomDirection, randomAxis);

        count++;
        if (count >= moves) {
            clearInterval(interval);
            // Restaura o contador de movimentos após embaralhar
            setTimeout(() => {
                moveCount = 0;
                window.checkSolved = tempCheckSolved; // Restaura a função original
            }, 500);
        }
    }, 150); // Intervalo entre giros para a animação processar
}

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 's') {
        shuffleCube(20); // Embaralha com 20 movimentos
    }
});


function checkSolved() {

    isSolved = cubies.every(piece => {
        return Math.round(piece.initial_position.x) === Math.round(piece.current_position.x) &&
            Math.round(piece.initial_position.y) === Math.round(piece.current_position.y) &&
            Math.round(piece.initial_position.z) === Math.round(piece.current_position.z);
    });

    if (isSolved && moveCount > 1) {
        alert("Parabéns! Você resolveu o cubo em " + moveCount + " movimentos!");
        moveCount = 0; // Reseta a contagem de movimentos para a próxima vez que o cubo for resolvido
        isSolved = false; // Reseta o estado de resolvido para permitir novas tentativas
        return true;
    }

    return false;
}

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();