export class QuantumForge {
    constructor() {
        this.overlay = document.getElementById('forge-overlay');
        this.launchBtn = document.getElementById('launch-forge');
        this.closeBtn = document.getElementById('close-forge');
        this.refreshBtn = document.getElementById('refresh-forge');
        this.form = document.getElementById('new-habit-form');
        this.habitList = document.getElementById('habit-active-list');
        this.predictionContainer = document.getElementById('forge-prediction');
        this.constellationContainer = document.getElementById('constellation-container');
        
        this.isActive = false;
        this.habits = [];
        this.init();
    }

    init() {
        this.launchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        this.closeBtn.addEventListener('click', () => this.close());
        this.refreshBtn.addEventListener('click', () => this.loadData());

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createHabit();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) this.close();
        });
    }

    async open() {
        this.overlay.classList.add('active');
        this.isActive = true;
        document.body.style.overflow = 'hidden';
        
        await this.loadData();
        lucide.createIcons();
    }

    close() {
        this.overlay.classList.remove('active');
        this.isActive = false;
        document.body.style.overflow = '';
    }

    async loadData() {
        const backendUrl = document.getElementById('backend-url').value.replace(/\/$/, "");
        
        try {
            // 1. Load Habits
            const habitRes = await fetch(`${backendUrl}/forge/habits`);
            this.habits = await habitRes.json();
            this.renderHabits();
            this.renderConstellation();

            // 2. Load Predictions
            const predictRes = await fetch(`${backendUrl}/forge/predict`);
            const predictions = await predictRes.json();
            this.renderPredictions(predictions);

        } catch (err) {
            console.error("Forge Data Load Failure:", err);
        }
    }

    async createHabit() {
        const backendUrl = document.getElementById('backend-url').value.replace(/\/$/, "");
        const name = document.getElementById('habit-name').value;
        const cue = document.getElementById('habit-cue').value;

        try {
            const res = await fetch(`${backendUrl}/forge/habits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cue })
            });
            if (res.ok) {
                this.form.reset();
                await this.loadData();
            }
        } catch (err) {
            console.error("Failed to engrave habit:", err);
        }
    }

    async logHabit(habitId) {
        const backendUrl = document.getElementById('backend-url').value.replace(/\/$/, "");
        try {
            const res = await fetch(`${backendUrl}/forge/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habit_id: habitId, status: 'completed' })
            });
            if (res.ok) {
                await this.loadData();
            }
        } catch (err) {
            console.error("Failed to log habit:", err);
        }
    }

    renderHabits() {
        this.habitList.innerHTML = this.habits.map(h => `
            <div class="habit-item">
                <div class="habit-info">
                    <h6>${h.name}</h6>
                    <span>Cue: ${h.cue || 'None'}</span>
                </div>
                <button class="log-btn ${h.logs.length > 0 ? 'logged' : ''}" 
                        onclick="window.quantumForge.logHabit(${h.id})" 
                        title="Log completion today">
                </button>
            </div>
        `).join('');
    }

    renderPredictions(data) {
        if (!data.projections || data.projections.length === 0) {
            this.predictionContainer.innerHTML = "Forge at least one habit to begin neural simulation...";
            return;
        }

        this.predictionContainer.innerHTML = data.projections.map(p => `
            <div class="prediction-entry">
                <h6>${p.habit} <span class="prediction-persona">${p.persona}</span></h6>
                <div class="prediction-text">
                    <p><b>30 Day Horizon:</b> ${p.prediction30Days}</p>
                    <p style="margin-top:0.5rem"><b>1 Year Evolution:</b> ${p.prediction365Days}</p>
                </div>
                <div style="margin-top:0.75rem; height:4px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden">
                    <div style="width:${p.consistency}%; height:100%; background:#bf9eff; box-shadow:0 0 10px #bf9eff"></div>
                </div>
            </div>
        `).join('');
    }

    renderConstellation() {
        const container = this.constellationContainer;
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(container)
            .append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`);

        const nodes = this.habits.map((h, i) => ({
            ...h,
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 5 + (h.logs.length * 2)
        }));

        const links = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                links.push({ source: nodes[i].id, target: nodes[j].id });
            }
        }

        // Add some "stellar dust" background particles
        svg.selectAll('.dust')
            .data(Array.from({length: 50}))
            .enter()
            .append('circle')
            .attr('cx', () => Math.random() * width)
            .attr('cy', () => Math.random() * height)
            .attr('r', () => Math.random() * 1.5)
            .attr('fill', '#bf9eff')
            .attr('opacity', 0.2);

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-150))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on('tick', () => {
                link.attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });

        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'constellation-link');

        const node = svg.append('g')
            .selectAll('.constellation-node')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'constellation-node');

        node.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', '#bf9eff')
            .attr('filter', 'blur(1px)')
            .attr('opacity', 0.8);

        node.append('circle')
            .attr('r', d => d.radius * 1.5)
            .attr('fill', 'none')
            .attr('stroke', '#bf9eff')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.3);

        node.append('text')
            .attr('dy', d => d.radius + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '10px')
            .attr('font-family', 'Outfit')
            .text(d => d.name);
    }
}
