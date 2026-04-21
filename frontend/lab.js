/**
 * @file lab.js
 * @description Zenith Growth Lab module. Handles 3D mission topology visualization
 * and real-time reasoning stream rendering using Three.js and Chart.js.
 */

/**
 * ZenithLab manages the interactive growth laboratory overlay.
 */
export class ZenithLab {
    /**
     * Creates an instance of ZenithLab.
     * Initializes DOM references and internal state.
     */
    constructor() {
        /** @type {HTMLElement} Overlay container */
        this.overlay = document.getElementById('lab-overlay');
        /** @type {HTMLElement} Launch trigger */
        this.launchBtn = document.getElementById('launch-lab');
        /** @type {HTMLElement} Close trigger */
        this.closeBtn = document.getElementById('close-lab');
        /** @type {HTMLElement} 3D Topology container */
        this.topologyContainer = document.getElementById('topology-container');
        /** @type {HTMLElement} Neural reasoning stream container */
        this.reasoningFeed = document.getElementById('reasoning-stream');
        /** @type {HTMLElement} Lab stats container */
        this.statsContainer = document.getElementById('lab-stats');

        // Three.js State
        /** @type {THREE.Scene} */
        this.scene = null;
        /** @type {THREE.PerspectiveCamera} */
        this.camera = null;
        /** @type {THREE.WebGLRenderer} */
        this.renderer = null;
        /** @type {Array<Object>} Active nodes in the scene */
        this.nodes = [];
        /** @type {Array<Object>} Active links in the scene */
        this.links = [];
        
        /** @type {Chart} Chart.js instance */
        this.chart = null;
        /** @type {boolean} Visibility state */
        this.isActive = false;

        this.init();
    }

    /**
     * Initializes event listeners and base lab logic.
     */
    init() {
        if (!this.launchBtn) return;

        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn?.addEventListener('click', () => this.close());

        // Global key capture for accessibility
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) this.close();
        });
    }

    /**
     * Opens the Zenith Lab overlay and bootstraps visualizations.
     */
    async open() {
        this.overlay.classList.add('active');
        this.isActive = true;
        document.body.style.overflow = 'hidden';
        
        // Initializing UI placeholders
        this.reasoningFeed.innerHTML = '<div style="color:hsla(var(--primary), 1)">INITIALIZING NEURAL LINK...</div>';
        this.statsContainer.innerHTML = '<div style="color:var(--text-dim)">CALIBRATING...</div>';

        this.init3DTopology();
        this.initCharts();
        this.startReasoningStream();
        await this.loadData();
        
        lucide.createIcons();
    }

    /**
     * Closes the lab and releases heavy resources.
     */
    close() {
        this.overlay.classList.remove('active');
        this.isActive = false;
        document.body.style.overflow = '';
        
        if (this.renderer) {
            this.renderer.dispose();
            this.topologyContainer.innerHTML = '';
        }
    }

    /**
     * Bootstraps the Three.js WebGL scene for 3D topology.
     */
    init3DTopology() {
        const width = this.topologyContainer.clientWidth;
        const height = this.topologyContainer.clientHeight;

        if (this.renderer) {
            this.topologyContainer.innerHTML = '';
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        this.topologyContainer.appendChild(this.renderer.domElement);

        this.camera.position.z = 60;

        // Illumination System
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0x00d2ff, 1.5);
        pointLight.position.set(20, 20, 20);
        this.scene.add(pointLight);

        /**
         * Local animation loop
         */
        const animate = () => {
            if (!this.isActive) return;
            requestAnimationFrame(animate);
            
            this.nodes.forEach(node => {
                node.mesh.rotation.x += 0.005;
                node.mesh.rotation.y += 0.01;
            });
            
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    /**
     * Fetches analytical data and topology nodes from the backend.
     */
    async loadData() {
        let backendUrlInput = document.getElementById('backend-url');
        let backendUrl = backendUrlInput ? backendUrlInput.value : 'http://localhost:5000';
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);

        try {
            // Load analytical stats
            const statsRes = await fetch(`${backendUrl}/analytics/stats`);
            if (!statsRes.ok) throw new Error("Analytics sync error");
            const stats = await statsRes.json();
            
            if (stats.totalMissions === 0) {
                this.renderEmptyState();
                return;
            }

            this.renderStats(stats);
            this.updateCharts(stats);

            // Load graph topology
            const topoRes = await fetch(`${backendUrl}/analytics/topology`);
            if (!topoRes.ok) throw new Error("Topology sync error");
            const topo = await topoRes.json();
            this.renderTopology(topo);

        } catch (err) {
            console.error("Zenith Lab Failure:", err);
            this.renderEmptyState("SIMULATION MODE: Strategic data offline. Syncing demo topology.");
            this.renderDemoTopology();
        }
    }

    /**
     * Renders an empty state message when no missions exist.
     * @param {string} message 
     */
    renderEmptyState(message = "NO NEURAL DATA detected. Start a mission to generate topology.") {
        this.statsContainer.innerHTML = `
            <div style="grid-column: 1/-1; color: var(--text-dim); font-size: 0.8rem; border: 1px dashed rgba(255,255,255,0.1); padding: 1rem; border-radius: 12px; text-align: center;">
                ${message}
            </div>`;
        this.renderDemoTopology();
    }

    /**
     * Generates a synthetic topology for demonstration purposes.
     */
    renderDemoTopology() {
        const demoNodes = Array.from({length: 8}, (_, i) => ({
            id: `demo_${i}`,
            type: i === 0 ? 'mission' : 'subtask',
            label: 'Demo Node',
            completed: Math.random() > 0.5
        }));
        const demoLinks = demoNodes.slice(1).map(n => ({ source: demoNodes[0].id, target: n.id }));
        this.renderTopology({ nodes: demoNodes, links: demoLinks });
    }

    /**
     * Renders numerical stats into the UI.
     * @param {Object} stats 
     */
    renderStats(stats) {
        this.statsContainer.innerHTML = `
            <div class="mini-stat">
                <span class="label">Accuracy</span>
                <span class="value">${stats.successRate}%</span>
            </div>
            <div class="mini-stat">
                <span class="label">Missions</span>
                <span class="value">${stats.totalMissions}</span>
            </div>
            <div class="mini-stat">
                <span class="label">Completed</span>
                <span class="value">${stats.completedMissions}</span>
            </div>
            <div class="mini-stat">
                <span class="label">Link Status</span>
                <span class="value" style="color:hsla(var(--accent), 1)">Stable</span>
            </div>
        `;
    }

    /**
     * Initializes the Chart.js doughnut chart.
     */
    initCharts() {
        const ctx = document.getElementById('growth-chart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Blitz', 'Balanced', 'Mastery'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#2188ff', '#3fb950', '#bf9eff'],
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8b949e', font: { size: 10 } }
                    }
                }
            }
        });
    }

    /**
     * Updates chart data with fresh stats.
     */
    updateCharts(stats) {
        if (!this.chart) return;
        this.chart.data.datasets[0].data = [
            stats.distribution.blitz,
            stats.distribution.balanced,
            stats.distribution.mastery
        ];
        this.chart.update();
    }

    /**
     * Renders the 3D graph (nodes and links) in the Three.js scene.
     * @param {Object} topo - Topology graph object.
     */
    renderTopology(topo) {
        // Resource Cleanup
        this.nodes.forEach(n => this.scene.remove(n.mesh));
        this.links.forEach(l => this.scene.remove(l.line));
        this.nodes = [];
        this.links = [];

        topo.nodes.forEach((node) => {
            const geometry = node.type === 'mission' ? 
                new THREE.IcosahedronGeometry(2, 0) : 
                new THREE.SphereGeometry(0.8, 8, 8);
            
            const material = new THREE.MeshPhongMaterial({
                color: node.completed ? 0x3fb950 : (node.type === 'mission' ? 0x2188ff : 0x8b949e),
                emissive: node.completed ? 0x2ea043 : 0x000000,
                emissiveIntensity: 0.5,
                wireframe: node.type === 'mission'
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (Math.random() - 0.5) * 60,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 20
            );
            
            this.scene.add(mesh);
            this.nodes.push({ id: node.id, mesh });
        });

        // Link Nodes
        topo.links.forEach(link => {
            const source = this.nodes.find(n => n.id === link.source);
            const target = this.nodes.find(n => n.id === link.target);

            if (source && target) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    source.mesh.position,
                    target.mesh.position
                ]);
                const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                this.links.push({ line });
            }
        });
    }

    /**
     * Starts the simulated reasoning feed.
     */
    startReasoningStream() {
        const signals = [
            "Analyzing behavioral patterns...",
            "Checking Milvus vector clusters...",
            "Synchronizing goal state across environments...",
            "Calculating success probability...",
            "Optimizing subtask decomposition logic...",
            "Generating strategic roadmap...",
            "Mimicking human UI interaction patterns...",
            "Reinforcing neural belief system...",
            "Validating expert knowledge base...",
            "Reclaiming strategic cognitive cycles..."
        ];

        let index = 0;
        this.reasoningFeed.innerHTML = '';
        
        const stream = () => {
            if (!this.isActive) return;
            const entry = document.createElement('div');
            entry.style.marginBottom = '0.5rem';
            entry.innerHTML = `<span style="color:hsla(var(--primary), 1)">>></span> ${signals[index % signals.length]}`;
            this.reasoningFeed.appendChild(entry);
            this.reasoningFeed.scrollTop = this.reasoningFeed.scrollHeight;
            
            if (this.reasoningFeed.childNodes.length > 20) {
                this.reasoningFeed.removeChild(this.reasoningFeed.firstChild);
            }

            index++;
            setTimeout(stream, 1500 + Math.random() * 2000);
        };
        stream();
    }
}
