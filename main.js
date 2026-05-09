// Importa o núcleo do Three.js como o objeto 'THREE'
import * as THREE from 'three';
// Importa o carregador específico para arquivos .gltf e .glb
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Importa o controle que permite orbitar a câmera com o mouse/touch
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURAÇÃO DA CENA ---

// Cria o "universo" onde todos os objetos, luzes e câmeras serão colocados
const scene = new THREE.Scene();
// Define a cor de fundo da cena (cinza bem claro neste caso)
scene.background = new THREE.Color(0xeeeeee);

// --- CÂMERA ---

// Cria uma câmera de perspectiva (objetos distantes parecem menores)
// Parâmetros: (Campo de Visão, Proporção da Tela, Corte Próximo, Corte Distante)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Posiciona a câmera nos eixos X=0, Y=1 (um pouco para cima), Z=5 (afastada do centro)
camera.position.set(0, 1, 5);

// --- RENDERIZADOR ---

// Seleciona o elemento <canvas> do HTML onde o desenho será feito
const canvas = document.querySelector('#three-canvas');
// Cria o renderizador WebGL, ativando o 'antialias' para suavizar bordas serrilhadas
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Define o tamanho da área de renderização para preencher toda a janela
renderer.setSize(window.innerWidth, window.innerHeight);
// Ajusta a resolução para telas de alta densidade (como Retina), evitando borrões
renderer.setPixelRatio(window.devicePixelRatio);

// --- ILUMINAÇÃO ---

// Cria uma luz direcional (como o Sol) com cor branca e intensidade máxima (1)
const light = new THREE.DirectionalLight(0xffffff, 1);
// Posiciona a fonte de luz no espaço
light.position.set(5, 5, 5);
// Adiciona a luz solar à cena
scene.add(light);
// Adiciona uma luz ambiente (suave) para que as sombras não fiquem totalmente pretas
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// --- INTERATIVIDADE ---

// Habilita o controle de órbita, vinculando-o à câmera e ao elemento do canvas
const controls = new OrbitControls(camera, renderer.domElement);

// --- CARREGAMENTO DO MODELO ---

// Instancia o carregador de arquivos GLB
const loader = new GLTFLoader();
// Tenta carregar o arquivo 'model.glb'
loader.load('model.glb', (gltf) => {
    // Se carregar com sucesso, adiciona o objeto extraído do arquivo à nossa cena
    scene.add(gltf.scene);
    console.log("Modelo carregado com sucesso!");
}, undefined, (error) => {
    // Caso ocorra algum erro (como arquivo não encontrado), exibe no console
    console.error("Erro ao carregar o modelo:", error);
});

// --- LOOP DE RENDERIZAÇÃO ---

// Função que será executada repetidamente para atualizar a imagem na tela
function animate() {
    // Pede ao navegador para chamar a função 'animate' novamente na próxima atualização de quadro (frame)
    requestAnimationFrame(animate);
    // Atualiza os controles do mouse (necessário para suavizar o movimento da câmera)
    controls.update();
    // Desenha efetivamente a cena sob o ponto de vista da câmera selecionada
    renderer.render(scene, camera);
}

// --- AJUSTE DINÂMICO (RESPONSIVO) ---

// Escuta se o usuário redimensionou a janela do navegador
window.addEventListener('resize', () => {
    // Atualiza a proporção da câmera para não achatar a imagem
    camera.aspect = window.innerWidth / window.innerHeight;
    // Avisa a câmera que os parâmetros mudaram
    camera.updateProjectionMatrix();
    // Ajusta o tamanho do renderizador para as novas dimensões da janela
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Inicia o loop de animação pela primeira vez
animate();