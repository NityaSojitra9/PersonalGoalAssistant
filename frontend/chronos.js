/**
 * @file chronos.js
 * @description Chronos Engine module. Visualizes the daily schedule as a 3D Temporal Vortex.
 */

export class ChronosEngine {
    constructor() {
        this.overlay = document.getElementById('chronos-overlay');
        this.launchBtn = document.getElementById('launch-chronos');
        this.closeBtn = document.getElementById('close-chronos');
        this.canvasContainer = document.getElementById('chronos-canvas-container');
        this.scheduleList = document.getElementById('chronos-schedule-list');
        
        this.isActive = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vortex = null;
        this.schedule = [];
        
        this.init();
    }

    init() {
        if (!this.launchBtn) return;

        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn?.addEventListener('click', () => this.close());

        // Handle navbar triggers
        document.addEventListener('click', (e) => {
            if (e.target.closest('#nav-launch-chronos') || 
                e.target.closest('#forge-nav-launch-chronos') || 
                e.target.closest('#aura-nav-launch-chronos') ||
                e.target.closest('#archive-nav-launch-chronos')) {
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
        this.init3DVortex();
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
            const res = await fetch(`${backendUrl}/chronos/schedule`);
            const data = await res.json();
            this.schedule = data.schedule;
            this.renderSchedule();
        } catch (err) {
            console.error("Chronos Sync Failure:", err);
        }
    }

    init3DVortex() {
        const width = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.camera.position.z = 10;
        this.camera.position.y = 5;
        this.camera.lookAt(0, 0, 0);

        // Vortex Geometry (Tube in a spiral)
        const curvePoints = [];
        for (let i = 0; i < 100; i++) {
            const t = i / 10;
            curvePoints.push(new THREE.Vector3(
                Math.cos(t) * (t / 2),
                t,
                Math.sin(t) * (t / 2)
            ));
        }
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        const geometry = new THREE.TubeGeometry(curve, 100, 0.1, 8, false);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00d2ff, 
            emissive: 0x00d2ff, 
            emissiveIntensity: 0.5,
            wireframe: true 
        });
        
        this.vortex = new THREE.Mesh(geometry, material);
        this.scene.add(this.vortex);

        // Add "Task Particles" along the vortex
        this.schedule.forEach((task, i) => {
            const t = (i / this.schedule.length) * 10;
            const particleGeom = new THREE.SphereGeometry(0.3, 16, 16);
            const particleMat = new THREE.MeshStandardMaterial({
                color: task.status === 'active' ? 0xff0000 : 0xbf9eff,
                emissive: task.status === 'active' ? 0xff0000 : 0xbf9eff,
                emissiveIntensity: 0.8
            });
            const particle = new THREE.Mesh(particleGeom, particleMat);
            particle.position.set(
                Math.cos(t) * (t / 2),
                t,
                Math.sin(t) * (t / 2)
            );
            this.scene.add(particle);
        });

        const animate = () => {
            if (!this.isActive) return;
            requestAnimationFrame(animate);
            this.vortex.rotation.y += 0.02;
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    renderSchedule() {
        this.scheduleList.innerHTML = this.schedule.map(s => `
            <div class="chronos-item ${s.status}">
                <div class="time">${s.time}</div>
                <div class="details">
                    <h6>${s.task}</h6>
                    <div class="intensity-bar">
                        <div style="width: ${s.intensity * 100}%"></div>
                    </div>
                </div>
                <div class="status-icon">
                    <i data-lucide="${s.status === 'completed' ? 'check-circle' : (s.status === 'active' ? 'play-circle' : 'circle')}"></i>
                </div>
            </div>
        `).join('');
    }
}
