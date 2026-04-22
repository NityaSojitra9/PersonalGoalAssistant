/**
 * @file main.js
 * @description Core application controller for the Personal Goal Assistant.
 * Orchestrates UI interactions, mission synchronization, and state management.
 * @version 2.1.0
 */

import { Background3D } from './background.js';
import { ZenithLab } from './lab.js';
import { QuantumForge } from './forge.js';

/**
 * AppController manages the main lifecycle of the Personal Goal Assistant frontend.
 */
class AppController {
    constructor() {
        /** @type {Object} UI Selectors */
        this.dom = {
            form: document.getElementById('rl-agent-form'),
            submitBtn: document.getElementById('submit-btn'),
            output: document.getElementById('output'),
            subtasksContainer: document.getElementById('subtasks'),
            resultContainer: document.getElementById('result'),
            statusBadge: document.getElementById('connection-status'),
            finalCard: document.getElementById('final-card'),
            settingsTrigger: document.getElementById('settings-trigger'),
            settingsPanel: document.getElementById('settings-panel'),
            reportSection: document.getElementById('mission-report-section'),
            reportContent: document.getElementById('report-content'),
            copyBtn: document.getElementById('copy-report-btn'),
            downloadBtn: document.getElementById('download-report-btn'),
            processingView: document.getElementById('processing-view'),
            progressBarParent: document.getElementById('mission-progress-parent'),
            progressBarFill: document.getElementById('mission-progress-fill'),
            historySection: document.getElementById('history-section'),
            historyList: document.getElementById('mission-history-list'),
            goalInput: document.getElementById('goal'),
            backendUrlInput: document.getElementById('backend-url'),
            userRank: document.getElementById('user-rank'),
            userLevel: document.getElementById('user-level'),
            userXp: document.getElementById('user-xp'),
            xpBarFill: document.getElementById('xp-bar-fill'),
            xpToNext: document.getElementById('xp-to-next')
        };

        this.init();
    }

    /**
     * Initializes the application components and event listeners.
     */
    init() {
        lucide.createIcons();
        this.setupObservers();
        this.setupEventListeners();
        this.setupZenith();
        this.loadMissions();
        this.loadUserStats();
        
        // Initialize supporting modules
        new Background3D();
        new ZenithLab();
        window.quantumForge = new QuantumForge();

        console.log("[*] Personal Goal Assistant successfully initialized.");
    }

    /**
     * Set up IntersectionObservers for scroll animations.
     */
    setupObservers() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal, .stagger-reveal').forEach(el => observer.observe(el));
    }

    /**
     * Attaches global event listeners to DOM elements.
     */
    setupEventListeners() {
        // Settings Toggle
        this.dom.settingsTrigger.addEventListener('click', () => {
            const isOpen = this.dom.settingsPanel.style.maxHeight !== '0px' && this.dom.settingsPanel.style.maxHeight !== '';
            this.dom.settingsPanel.style.maxHeight = isOpen ? '0px' : '200px';
        });

        // Form Submission
        this.dom.form.addEventListener('submit', (e) => this.handleMissionSubmission(e));

        // Report Actions
        this.dom.copyBtn.addEventListener('click', () => this.copyReportToClipboard());
        this.dom.downloadBtn.addEventListener('click', () => this.downloadReport());

        // Dynamic Elements Delegation (Blueprint Pills)
        document.querySelectorAll('.blueprint-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this.dom.goalInput.value = pill.innerText;
                this.dom.goalInput.focus();
                this.dom.goalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    }

    /**
     * Handles the mission planning submission flow.
     * @param {Event} e 
     */
    async handleMissionSubmission(e) {
        e.preventDefault();
        
        const goal = this.dom.goalInput.value;
        const intensity = document.querySelector('input[name="intensity"]:checked').value;
        const persona = document.querySelector('input[name="persona"]:checked').value;
        let backendUrl = this.dom.backendUrlInput.value;
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);

        this.setUIState('loading');

        try {
            const response = await fetch(`${backendUrl}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, intensity, persona }),
            });

            if (!response.ok) throw new Error(`Network status error: ${response.status}`);

            const data = await response.json();
            this.handleMissionSuccess(data, goal, backendUrl);

        } catch (error) {
            this.handleMissionFailure(error);
        } finally {
            this.setUIState('idle');
        }
    }

    /**
     * Updates the UI state based on application status.
     * @param {'loading' | 'idle'} state 
     */
    setUIState(state) {
        if (state === 'loading') {
            this.dom.submitBtn.disabled = true;
            this.dom.submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 18px;"></i> SYNCHRONIZING...';
            this.dom.output.innerHTML = '';
            this.dom.subtasksContainer.innerHTML = '';
            this.dom.reportContent.innerHTML = '';
            this.dom.reportSection.style.display = 'none';
            this.dom.processingView.style.display = 'block';
            this.dom.finalCard.style.display = 'none';
            this.dom.statusBadge.style.display = 'block';
            this.dom.statusBadge.textContent = 'Synchronizing with Life Engine...';
            this.dom.statusBadge.style.color = 'hsla(var(--primary), 1)';
        } else {
            this.dom.submitBtn.disabled = false;
            this.dom.submitBtn.innerHTML = '<i data-lucide="play" style="width: 18px;"></i> INITIATE MISSION';
        }
        lucide.createIcons();
    }

    /**
     * Renders success data and begins staggered logging.
     * @param {Object} data - API response data.
     * @param {string} goal - Original goal string.
     * @param {string} backendUrl - Active backend endpoint.
     */
    handleMissionSuccess(data, goal, backendUrl) {
        this.dom.statusBadge.textContent = 'Mission Ready';
        this.dom.statusBadge.style.color = '#3fb950';
        this.dom.output.innerHTML = '';

        // Render Subtasks
        if (data.subtasks) {
            data.subtasks.forEach((st, index) => {
                setTimeout(() => {
                    const div = document.createElement('div');
                    div.className = 'subtask-card';
                    div.innerHTML = `<strong>${index + 1}</strong> &nbsp; ${st.text}`;
                    this.dom.subtasksContainer.appendChild(div);
                }, index * 100);
            });
        }

        // Render Execution Logs
        if (data.agent_output && data.agent_output.length > 0) {
            data.agent_output.forEach((item, index) => {
                setTimeout(() => {
                    const log = document.createElement('div');
                    log.className = 'log-entry';
                    log.style.marginBottom = '0.75rem';
                    log.style.padding = '0.5rem';
                    log.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    log.innerHTML = `<span style="color:hsla(var(--accent), 1)">[STEP ${item.step}]</span> ${item.action} &rarr; <span style="color:#3fb950; font-weight:bold">${item.status}</span>`;
                    this.dom.output.appendChild(log);
                    this.dom.output.scrollTop = this.dom.output.scrollHeight;

                    if (index === data.agent_output.length - 1) {
                        this.finalizeMission(goal, data, backendUrl);
                    }
                }, index * 200 + 1000);
            });
        } else if (data.subtasks) {
            this.finalizeMission(goal, data, backendUrl);
        }
    }

    /**
     * Displays final reports and status cards.
     */
    finalizeMission(goal, data, backendUrl) {
        setTimeout(() => {
            this.renderMissionReport(goal, data.subtasks, backendUrl);
            this.dom.finalCard.style.display = 'block';
            this.dom.finalCard.style.animation = 'fadeIn 0.5s ease-out';
            this.dom.resultContainer.textContent = data.result || 'Mission Objectives Materialized Successfully.';
        }, 500);
    }

    /**
     * Handles link errors and termination.
     */
    handleMissionFailure(error) {
        this.dom.statusBadge.textContent = 'Neural Link Error';
        this.dom.statusBadge.style.color = '#f85149';
        this.dom.finalCard.style.display = 'block';
        this.dom.finalCard.style.borderColor = '#f85149';
        this.dom.resultContainer.textContent = `Termination: ${error.message}`;
    }

    /**
     * Renders the interactive mission report.
     */
    renderMissionReport(goal, subtasks, backendUrl) {
        this.dom.processingView.style.display = 'none';
        this.dom.progressBarParent.style.display = 'block';
        this.dom.reportSection.style.display = 'block';
        this.dom.reportSection.classList.add('active');
        
        let html = `<h2>Mission Outcome: ${goal}</h2>`;
        html += `<p>Interactive Checklist: Track your execution progress below.</p>`;
        html += `<div class="checklist">`;
        
        subtasks.forEach((st) => {
            const isChecked = st.is_completed ? 'checked' : '';
            const completedClass = st.is_completed ? 'completed' : '';
            html += `
                <div class="task-item ${completedClass}" data-id="${st.id}">
                    <input type="checkbox" class="task-checkbox" ${isChecked}>
                    <span>${st.text}</span>
                </div>`;
        });
        
        html += `</div>`;
        html += `<p style="margin-top: 2rem; color: var(--text-dim); font-size: 0.8rem;"><i>&copy; Generated by Goal.Personal Autonomous Executive</i></p>`;
        
        this.dom.reportContent.innerHTML = html;
        this.updateProgress();
        this.setupChecklistListeners(backendUrl);
        
        this.dom.reportSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Attaches listeners to checklist items for backend synchronization.
     */
    setupChecklistListeners(backendUrl) {
        const checkboxes = this.dom.reportContent.querySelectorAll('.task-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const item = e.target.closest('.task-item');
                const subtask_id = item.getAttribute('data-id');
                const isChecked = e.target.checked;
                
                item.classList.toggle('completed', isChecked);
                
                try {
                    await fetch(`${backendUrl}/subtasks/${subtask_id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_completed: isChecked })
                    });
                    const data = await response.json();
                    if (data.userStats) {
                        this.updateMasteryUI(data.userStats);
                    }
                    this.updateProgress();
                } catch (err) {
                    console.error("Failed to sync subtask state:", err);
                }
            });
        });
    }

    /**
     * Fetches current mastery statistics from the backend.
     */
    async loadUserStats() {
        let backendUrl = this.dom.backendUrlInput.value;
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);
        
        try {
            const response = await fetch(`${backendUrl}/user/stats`);
            if (!response.ok) return;
            const stats = await response.json();
            this.updateMasteryUI(stats);
        } catch (err) {
            console.warn("Mastery synchronization bypassed.");
        }
    }

    /**
     * Updates the mastery widget with new stats.
     * @param {Object} stats 
     */
    updateMasteryUI(stats) {
        this.dom.userRank.textContent = stats.rank;
        this.dom.userLevel.textContent = stats.level;
        this.dom.userXp.textContent = stats.xp.toLocaleString();
        
        // Calculate progress to next level
        const currentLevelXp = ((stats.level - 1) ** 2) * 100;
        const nextLevelXp = stats.nextLevelXp;
        const progressInLevel = stats.xp - currentLevelXp;
        const totalInLevel = nextLevelXp - currentLevelXp;
        
        const percentage = Math.min(Math.max((progressInLevel / totalInLevel) * 100, 0), 100);
        this.dom.xpBarFill.style.width = `${percentage}%`;
        
        const remaining = nextLevelXp - stats.xp;
        this.dom.xpToNext.textContent = `${remaining.toLocaleString()} XP to next level`;

        // Rank-based color updates
        const rankColors = {
            "Novice Explorer": "hsla(var(--primary), 1)",
            "Strategic Architect": "hsla(var(--accent), 1)",
            "Mission Commander": "#ffcc00",
            "Silicon Overlord": "#ff3366"
        };
        this.dom.userRank.style.color = rankColors[stats.rank] || "white";
    }

    /**
     * Updates the mission progress bar based on completed items.
     */
    updateProgress() {
        const items = document.querySelectorAll('.task-item');
        if (items.length === 0) return;
        
        const completedItems = document.querySelectorAll('.task-item.completed');
        const percentage = (completedItems.length / items.length) * 100;
        
        this.dom.progressBarFill.style.width = `${percentage}%`;
        this.dom.progressBarFill.style.background = percentage === 100 
            ? 'linear-gradient(to right, #3fb950, #2ea043)' 
            : 'linear-gradient(to right, hsla(var(--primary), 1), hsla(var(--accent), 1))';
    }

    /**
     * Utility: Copy report text to clipboard.
     */
    copyReportToClipboard() {
        const text = this.dom.reportContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = this.dom.copyBtn.innerHTML;
            this.dom.copyBtn.innerHTML = '<i data-lucide="check" style="width: 16px;"></i>';
            lucide.createIcons();
            setTimeout(() => {
                this.dom.copyBtn.innerHTML = originalIcon;
                lucide.createIcons();
            }, 2000);
        });
    }

    /**
     * Utility: Download report as a text file.
     */
    downloadReport() {
        const text = this.dom.reportContent.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Mission_Report_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Set up Zenith-specific interactive elements (counters).
     */
    setupZenith() {
        const counters = document.querySelectorAll('.stat-value[data-target]');
        const dashboard = document.querySelector('.success-dashboard');

        if (!dashboard) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounters(counters);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(dashboard);
    }

    /**
     * Animates numerical labels from 0 to target value.
     * @param {NodeList} counters 
     */
    animateCounters(counters) {
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            let count = 0;
            const increment = target / 100;
            const updateCount = () => {
                if (count < target) {
                    count += increment;
                    counter.innerText = Math.ceil(count).toLocaleString() + (target > 500 ? '+' : '');
                    setTimeout(updateCount, 20);
                } else {
                    counter.innerText = target.toLocaleString() + (target > 500 ? '+' : '');
                }
            };
            updateCount();
        });
    }

    /**
     * Loads past mission history from the backend.
     */
    async loadMissions() {
        let backendUrl = this.dom.backendUrlInput.value;
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);
        
        try {
            const response = await fetch(`${backendUrl}/missions`);
            if (!response.ok) return;
            const missions = await response.json();
            
            if (missions.length > 0) {
                this.dom.historySection.style.display = 'block';
                this.dom.historyList.innerHTML = '';
                
                missions.slice(0, 5).forEach(m => {
                    const item = this.createHistoryItem(m, backendUrl);
                    this.dom.historyList.appendChild(item);
                });
                lucide.createIcons();
            }
        } catch (err) {
            console.warn("Mission history synchronization bypassed.");
        }
    }

    /**
     * Creates a history list item element.
     */
    createHistoryItem(m, backendUrl) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.style.padding = '0.75rem';
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.border = '1px solid var(--border)';
        item.style.borderRadius = '8px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.transition = 'all 0.2s ease';
        
        const date = new Date(m.timestamp).toLocaleDateString();
        item.innerHTML = `
            <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: white;">${m.goal}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${date} • ${m.intensity.toUpperCase()}</div>
            </div>
            <i data-lucide="chevron-right" style="width: 14px; color: var(--text-dim);"></i>
        `;
        
        item.addEventListener('click', () => {
            this.dom.goalInput.value = m.goal;
            this.renderMissionReport(m.goal, m.subtasks, backendUrl);
        });
        
        return item;
    }
}

// Global Application Bootstrapping
window.addEventListener('load', () => {
    window.app = new AppController();
});
