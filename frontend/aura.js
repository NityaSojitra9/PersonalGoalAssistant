/**
 * @file aura.js
 * @description Aura Nexus module. Visualizes the user's personality aura using 3D generative geometry.
 */

export class AuraNexus {
    constructor() {
        this.overlay = document.getElementById('aura-overlay');
        this.launchBtn = document.getElementById('launch-aura');
        this.closeBtn = document.getElementById('close-aura');
        this.canvasContainer = document.getElementById('aura-canvas-container');
        this.auraInfo = document.getElementById('aura-info-text');
        this.auraType = document.getElementById('aura-type-label');
        
        this.isActive = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.auraMesh = null;
        this.auraColor = 'hsla(180, 100%, 50%, 0.6)';
        
        this.init();
    }

    init() {
        if (!this.launchBtn) return;

        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn?.addEventListener('click', () => this.close());

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) this.close();
        });
    }

    async open() {
        this.overlay.classList.add('active');
        this.isActive = true;
        document.body.style.overflow = 'hidden';

        this.init3DAura();
        await this.loadAuraData();
        
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

    init3DAura() {
        const width = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(5, 5, 5);
        this.scene.add(pointLight);

        // Aura Geometry (Morphed Icosahedron)
        const geometry = new THREE.IcosahedronGeometry(2, 4);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.auraColor),
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            emissive: new THREE.Color(this.auraColor),
            emissiveIntensity: 0.5
        });

        this.auraMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.auraMesh);

        const animate = () => {
            if (!this.isActive) return;
            requestAnimationFrame(animate);

            this.auraMesh.rotation.y += 0.01;
            this.auraMesh.rotation.z += 0.005;

            // Simple noise-like vertex vibration
            const time = Date.now() * 0.001;
            const positionAttribute = this.auraMesh.geometry.getAttribute('position');
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positionAttribute.count; i++) {
                vertex.fromBufferAttribute(positionAttribute, i);
                const noise = Math.sin(vertex.x * 2 + time) * 0.05;
                vertex.normalize().multiplyScalar(2 + noise);
                positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
            positionAttribute.needsUpdate = true;

            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    async loadAuraData() {
        const backendUrl = document.getElementById('backend-url').value.replace(/\/$/, "");
        
        try {
            const res = await fetch(`${backendUrl}/analytics/aura`);
            const data = await res.json();
            
            this.auraType.textContent = data.type;
            this.auraInfo.textContent = data.description;
            this.auraColor = data.color;
            
            if (this.auraMesh) {
                this.auraMesh.material.color.set(new THREE.Color(data.color));
                this.auraMesh.material.emissive.set(new THREE.Color(data.color));
            }

            this.renderAuraStats(data.stats);

        } catch (err) {
            console.error("Aura Sync Failure:", err);
            this.auraType.textContent = "Neutral Entity";
            this.auraInfo.textContent = "Neural connection intermittent. Visualizing default state.";
        }
    }

    renderAuraStats(stats) {
        const container = document.getElementById('aura-stats-grid');
        if (!container) return;
        
        container.innerHTML = `
            <div class="aura-stat-card">
                <span class="label">Blitz Velocity</span>
                <div class="progress-mini"><div style="width:${stats.blitz}%"></div></div>
                <span class="val">${stats.blitz}%</span>
            </div>
            <div class="aura-stat-card">
                <span class="label">Balance Index</span>
                <div class="progress-mini"><div style="width:${stats.balanced}%"></div></div>
                <span class="val">${stats.balanced}%</span>
            </div>
            <div class="aura-stat-card">
                <span class="label">Mastery Depth</span>
                <div class="progress-mini"><div style="width:${stats.mastery}%"></div></div>
                <span class="val">${stats.mastery}%</span>
            </div>
        `;
    }
}
