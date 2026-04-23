/**
 * @file archive.js
 * @description Neural Archive module. Visualizes the Expert Knowledge Base as a 3D interactive graph.
 */

export class NeuralArchive {
    constructor() {
        this.overlay = document.getElementById('archive-overlay');
        this.launchBtn = document.getElementById('launch-archive');
        this.closeBtn = document.getElementById('close-archive');
        this.canvasContainer = document.getElementById('archive-canvas-container');
        this.detailPanel = document.getElementById('knowledge-detail-content');
        
        this.isActive = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.nodes = [];
        this.links = [];
        this.data = null;
        
        this.init();
    }

    init() {
        if (!this.launchBtn) return;

        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn?.addEventListener('click', () => this.close());
        
        // Handle navbar triggers from other overlays
        document.addEventListener('click', (e) => {
            if (e.target.closest('#nav-launch-archive') || 
                e.target.closest('#forge-nav-launch-archive') || 
                e.target.closest('#aura-nav-launch-archive') ||
                e.target.closest('#chronos-nav-launch-archive')) {
                this.open();
            }
        });
    }

    async open() {
        // Close other overlays
        document.querySelectorAll('.lab-overlay.active').forEach(overlay => {
            if (overlay !== this.overlay) overlay.classList.remove('active');
        });

        this.overlay.classList.add('active');
        this.isActive = true;
        document.body.style.overflow = 'hidden';

        await this.loadData();
        this.init3DGraph();
        lucide.createIcons();
    }

    close() {
        this.overlay.classList.remove('active');
        this.isActive = false;
        document.body.style.overflow = '';
        
        if (this.renderer) {
            this.renderer.dispose();
            this.canvasContainer.innerHTML = '';
        }
    }

    async loadData() {
        const backendUrl = document.getElementById('backend-url').value.replace(/\/$/, "");
        try {
            const res = await fetch(`${backendUrl}/analytics/knowledge`);
            this.data = await res.json();
        } catch (err) {
            console.error("Archive Sync Failure:", err);
        }
    }

    init3DGraph() {
        if (!this.data) return;

        const width = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.camera.position.z = 20;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);

        // Create Nodes
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        this.data.nodes.forEach(nodeData => {
            const material = new THREE.MeshStandardMaterial({
                color: nodeData.color,
                emissive: nodeData.color,
                emissiveIntensity: 0.2
            });
            const node = new THREE.Mesh(geometry, material);
            node.position.set(
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 30
            );
            node.userData = nodeData;
            this.scene.add(node);
            this.nodes.push(node);
        });

        // Create Links (Lines)
        const linkMaterial = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 });
        this.data.links.forEach(linkData => {
            const source = this.nodes.find(n => n.userData.id === linkData.source);
            const target = this.nodes.find(n => n.userData.id === linkData.target);
            if (source && target) {
                const points = [source.position, target.position];
                const linkGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(linkGeometry, linkMaterial);
                this.scene.add(line);
                this.links.push({ line, source, target });
            }
        });

        const animate = () => {
            if (!this.isActive) return;
            requestAnimationFrame(animate);

            this.nodes.forEach(node => {
                node.rotation.y += 0.01;
                // Subtle floating motion
                node.position.y += Math.sin(Date.now() * 0.001 + node.position.x) * 0.005;
            });

            // Update Link positions
            this.links.forEach(link => {
                const positions = link.line.geometry.attributes.position.array;
                positions[0] = link.source.position.x;
                positions[1] = link.source.position.y;
                positions[2] = link.source.position.z;
                positions[3] = link.target.position.x;
                positions[4] = link.target.position.y;
                positions[5] = link.target.position.z;
                link.line.geometry.attributes.position.needsUpdate = true;
            });

            this.renderer.render(this.scene, this.camera);
        };
        animate();

        // Raycaster for interaction
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        this.canvasContainer.addEventListener('click', (e) => {
            const rect = this.canvasContainer.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

            raycaster.setFromCamera(mouse, this.camera);
            const intersects = raycaster.intersectObjects(this.nodes);

            if (intersects.length > 0) {
                const node = intersects[0].object;
                this.showNodeDetails(node.userData);
            }
        });
    }

    showNodeDetails(node) {
        if (node.type === 'step') {
            this.detailPanel.innerHTML = `
                <div class="knowledge-step active">
                    <div class="step-icon"><i data-lucide="book-open"></i></div>
                    <div class="step-body">
                        <h6>${node.label}</h6>
                        <p>${node.full_text}</p>
                    </div>
                </div>
            `;
        } else {
            this.detailPanel.innerHTML = `
                <div class="knowledge-intro">
                    <h5>${node.label}</h5>
                    <p>Category: ${node.type.toUpperCase()}</p>
                    <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 1rem;">Select a step node in the 3D graph to view detailed mission requirements.</p>
                </div>
            `;
        }
        lucide.createIcons();
    }
}
