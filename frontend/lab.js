export class ZenithLab {
    constructor() {
        this.overlay = document.getElementById('lab-overlay');
        this.launchBtn = document.getElementById('launch-lab');
        this.closeBtn = document.getElementById('close-lab');
        this.topologyContainer = document.getElementById('topology-container');
        this.reasoningFeed = document.getElementById('reasoning-stream');
        this.statsContainer = document.getElementById('lab-stats');

        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.nodes = [];
        this.links = [];
        this.chart = null;
        this.isActive = false;

        this.init();
    }

    init() {
        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn.addEventListener('click', () => this.close());

        // Handle Escape to close
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) this.close();
        });
    }

    async open() {
        this.overlay.classList.add('active');
        this.isActive = true;
        document.body.style.overflow = 'hidden';
        
        // Setup placeholders
        this.reasoningFeed.innerHTML = '<div style="color:hsla(var(--primary), 1)">INITIALIZING NEURAL LINK...</div>';
        this.statsContainer.innerHTML = '<div style="color:var(--text-dim)">CALIBRATING...</div>';

        this.init3DTopology();
        this.initCharts();
        this.startReasoningStream();
        await this.loadData();
        
        lucide.createIcons();
    }

    close() {
        this.overlay.classList.remove('active');
        this.isActive = false;
        document.body.style.overflow = '';
        
        if (this.renderer) {
            this.renderer.dispose();
            this.topologyContainer.innerHTML = '';
        }
    }

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

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0x00d2ff, 1.5);
        pointLight.position.set(20, 20, 20);
        this.scene.add(pointLight);

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

    async loadData() {
        let backendUrlInput = document.getElementById('backend-url');
        let backendUrl = backendUrlInput ? backendUrlInput.value : 'http://localhost:5000';
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);

        try {
            // 1. Load Stats
            const statsRes = await fetch(`${backendUrl}/analytics/stats`);
            if (!statsRes.ok) throw new Error("Stats fetch failed");
            const stats = await statsRes.json();
            
            if (stats.totalMissions === 0) {
                this.renderEmptyState();
                return;
            }

            this.renderStats(stats);
            this.updateCharts(stats);

            // 2. Load Topology
            const topoRes = await fetch(`${backendUrl}/analytics/topology`);
            if (!topoRes.ok) throw new Error("Topology fetch failed");
            const topo = await topoRes.json();
            this.renderTopology(topo);

        } catch (err) {
            console.error("Lab Data Load Failure:", err);
            this.renderEmptyState("SIMULATION MODE: Neural data offline. Connect to node to sync real-time metrics.");
            this.renderDemoTopology();
        }
    }

    renderEmptyState(message = "NO NEURAL DATA detected. Start a mission to generate growth topology.") {
        this.statsContainer.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-dim); font-size: 0.8rem; border: 1px dashed rgba(255,255,255,0.1); padding: 1rem; border-radius: 12px; text-align: center;">${message}</div>`;
        this.renderDemoTopology();
    }

    renderDemoTopology() {
        // Create 5-10 random demo nodes if the lab is empty
        const demoNodes = Array.from({length: 8}, (_, i) => ({
            id: `demo_${i}`,
            type: i === 0 ? 'mission' : 'subtask',
            label: 'Demo Node',
            completed: Math.random() > 0.5
        }));
        const demoLinks = demoNodes.slice(1).map(n => ({ source: demoNodes[0].id, target: n.id }));
        this.renderTopology({ nodes: demoNodes, links: demoLinks });
    }

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
                <span class="label">Active Link</span>
                <span class="value" style="color:hsla(var(--accent), 1)">Stable</span>
            </div>
        `;
    }

    initCharts() {
        const ctx = document.getElementById('growth-chart').getContext('2d');
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Blitz', 'Balanced', 'Mastery'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#00d2ff', '#00ff9d', '#bf9eff'],
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

    updateCharts(stats) {
        if (!this.chart) return;
        this.chart.data.datasets[0].data = [
            stats.distribution.blitz,
            stats.distribution.balanced,
            stats.distribution.mastery
        ];
        this.chart.update();
    }

    renderTopology(topo) {
        // Clear old nodes
        this.nodes.forEach(n => this.scene.remove(n.mesh));
        this.links.forEach(l => this.scene.remove(l.line));
        this.nodes = [];
        this.links = [];

        topo.nodes.forEach((node, i) => {
            const geometry = node.type === 'mission' ? 
                new THREE.IcosahedronGeometry(2, 0) : 
                new THREE.SphereGeometry(0.8, 8, 8);
            
            const material = new THREE.MeshPhongMaterial({
                color: node.completed ? 0x00ff9d : (node.type === 'mission' ? 0x00d2ff : 0x8b949e),
                emissive: node.completed ? 0x00ff9d : 0x000000,
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

        topo.links.forEach(link => {
            const sourceNode = this.nodes.find(n => n.id === link.source);
            const targetNode = this.nodes.find(n => n.id === link.target);

            if (sourceNode && targetNode) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    sourceNode.mesh.position,
                    targetNode.mesh.position
                ]);
                const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                this.links.push({ line });
            }
        });
    }

    startReasoningStream() {
        const thoughts = [
            "Analyzing behavioral patterns...",
            "Checking Milvus vector clusters...",
            "Synchronizing goal state across environments...",
            "Calculating success probability for mastery missions...",
            "Optimizing subtask decomposition logic...",
            "Generating strategic roadmap for personal objective...",
            "Mimicking human UI interaction patterns...",
            "Reinforcing neural belief system...",
            "Validating expert knowledge base blueprints...",
            "Reclaiming strategic cognitive cycles..."
        ];

        let i = 0;
        this.reasoningFeed.innerHTML = '';
        
        const typeNext = () => {
            if (!this.isActive) return;
            const p = document.createElement('div');
            p.style.marginBottom = '0.5rem';
            p.innerHTML = `<span class="thought">></span> <span class="action">${thoughts[i % thoughts.length]}</span>`;
            this.reasoningFeed.appendChild(p);
            this.reasoningFeed.scrollTop = this.reasoningFeed.scrollHeight;
            
            if (this.reasoningFeed.childNodes.length > 20) {
                this.reasoningFeed.removeChild(this.reasoningFeed.firstChild);
            }

            i++;
            setTimeout(typeNext, 1000 + Math.random() * 2000);
        };
        typeNext();
    }
}
