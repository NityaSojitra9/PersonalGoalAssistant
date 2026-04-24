/**
 * @file forge.js
 * @description Quantum Forge module. Habit tracking with D3 constellation visualization.
 */

export class QuantumForge {
    constructor() {
        this.overlay = document.getElementById('page-forge');
        this.form = document.getElementById('new-habit-form');
        this.habitList = document.getElementById('habit-active-list');
        this.predictionContainer = document.getElementById('forge-prediction');
        this.constellationContainer = document.getElementById('constellation-container');

        this.isActive = false;
        this.habits = [];
        this.init();
    }

    init() {
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createHabit();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) window.location.hash = '#/';
        });
    }

    async open() {
        this.isActive = true;
        setTimeout(async () => {
            await this.loadData();
            lucide.createIcons();
        }, 100);
    }

    /** Dispose resources — called by router when navigating away. */
    dispose() {
        this.isActive = false;
        if (this.constellationContainer) this.constellationContainer.innerHTML = '';
    }

    getBackendUrl() {
        const input = document.getElementById('backend-url');
        return (input ? input.value : 'http://localhost:5000').replace(/\/$/, '');
    }

    async loadData() {
        const backendUrl = this.getBackendUrl();
        try {
            const habitRes = await fetch(`${backendUrl}/forge/habits`);
            if (!habitRes.ok) throw new Error('Habits offline');
            this.habits = await habitRes.json();
            this.renderHabits();
            this.renderConstellation();

            const predictRes = await fetch(`${backendUrl}/forge/predict`);
            if (!predictRes.ok) throw new Error('Predictions offline');
            this.renderPredictions(await predictRes.json());

        } catch (err) {
            console.warn('Forge — backend offline:', err.message);
            this.habits = [];
            this.renderHabits();
            this.renderConstellation();
            if (this.predictionContainer) {
                this.predictionContainer.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;">Start the backend server to track and predict habits.</div>`;
            }
        }
    }

    async createHabit() {
        const backendUrl = this.getBackendUrl();
        const name = document.getElementById('habit-name')?.value.trim();
        const cue = document.getElementById('habit-cue')?.value.trim();
        if (!name) return;
        try {
            const res = await fetch(`${backendUrl}/forge/habits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cue })
            });
            if (res.ok) { this.form.reset(); await this.loadData(); }
        } catch (err) { console.error('Failed to engrave habit:', err); }
    }

    async logHabit(habitId) {
        const backendUrl = this.getBackendUrl();
        try {
            const res = await fetch(`${backendUrl}/forge/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habit_id: habitId, status: 'completed' })
            });
            if (res.ok) await this.loadData();
        } catch (err) { console.error('Failed to log habit:', err); }
    }

    renderHabits() {
        if (!this.habitList) return;
        if (!this.habits || this.habits.length === 0) {
            this.habitList.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;padding:1rem 0;">No habits forged yet. Create one below.</div>`;
            return;
        }
        this.habitList.innerHTML = this.habits.map(h => `
            <div class="habit-item">
                <div style="flex:1">
                    <div style="font-weight:700;font-size:0.9rem;color:white;">${h.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-dim);">Cue: ${h.cue || '—'} &bull; Streak: ${h.logs ? h.logs.length : 0} days</div>
                </div>
                <button onclick="window.quantumForge.logHabit(${h.id})"
                    style="padding:0.4rem 0.9rem;background:hsla(var(--accent),0.15);border:1px solid hsla(var(--accent),0.4);color:hsla(var(--accent),1);border-radius:8px;cursor:pointer;font-size:0.75rem;font-weight:700;transition:all 0.2s;">
                    LOG ✓
                </button>
            </div>`).join('');
    }

    renderPredictions(data) {
        if (!this.predictionContainer) return;
        if (!data.projections || data.projections.length === 0) {
            this.predictionContainer.innerHTML = `<div style="color:var(--text-dim);">Forge at least one habit to begin neural simulation...</div>`;
            return;
        }
        this.predictionContainer.innerHTML = data.projections.map(p => `
            <div style="padding:1rem;border-radius:12px;background:rgba(191,158,255,0.05);border:1px solid rgba(191,158,255,0.15);margin-bottom:0.75rem;">
                <div style="font-weight:700;color:#bf9eff;margin-bottom:0.5rem;">${p.habit} <span style="font-size:0.7rem;opacity:0.6;">${p.persona}</span></div>
                <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.25rem;"><b style="color:white;">30 Days:</b> ${p.prediction30Days}</p>
                <p style="font-size:0.8rem;color:var(--text-dim);"><b style="color:white;">1 Year:</b> ${p.prediction365Days}</p>
                <div style="margin-top:0.75rem;height:4px;background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;">
                    <div style="width:${p.consistency}%;height:100%;background:#bf9eff;box-shadow:0 0 8px #bf9eff;"></div>
                </div>
            </div>`).join('');
    }

    renderConstellation() {
        const container = this.constellationContainer;
        if (!container) return;
        container.innerHTML = '';
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 500;

        const svg = d3.select(container).append('svg').attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

        // Stellar dust
        svg.selectAll('.dust').data(Array.from({ length: 80 })).enter().append('circle')
            .attr('cx', () => Math.random() * width).attr('cy', () => Math.random() * height)
            .attr('r', () => Math.random() * 1.5).attr('fill', '#bf9eff').attr('opacity', 0.15);

        if (!this.habits || this.habits.length === 0) {
            svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle')
                .attr('fill', '#8b949e').attr('font-size', '13px').attr('font-family', 'Fira Code')
                .text('Create habits to see your constellation...');
            return;
        }

        const nodes = this.habits.map(h => ({
            ...h, x: Math.random() * (width - 100) + 50, y: Math.random() * (height - 100) + 50,
            radius: 6 + ((h.logs ? h.logs.length : 0) * 2)
        }));
        const links = [];
        for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++)
                links.push({ source: i, target: j });

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).distance(120))
            .force('charge', d3.forceManyBody().strength(-150))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on('tick', () => {
                link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });

        const link = svg.append('g').selectAll('line').data(links).enter().append('line')
            .attr('stroke', '#bf9eff').attr('stroke-opacity', 0.15).attr('stroke-width', 1);
        const node = svg.append('g').selectAll('.constellation-node').data(nodes).enter().append('g').attr('class', 'constellation-node');
        node.append('circle').attr('r', d => d.radius).attr('fill', '#bf9eff').attr('opacity', 0.85);
        node.append('circle').attr('r', d => d.radius * 2).attr('fill', 'none').attr('stroke', '#bf9eff').attr('stroke-width', 0.5).attr('opacity', 0.2);
        node.append('text').attr('dy', d => d.radius + 14).attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', '10px').attr('font-family', 'Outfit').text(d => d.name);
        simulation.alpha(1).restart();
    }
}
