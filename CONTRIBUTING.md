# Contributing to Personal Goal Assistant

Welcome! This document outlines the standards and structural conventions for contributing to the Personal Goal Assistant project.

## Architecture Overview

The project follows a **Modular Monolith** approach for the frontend and a **Blueprint-ready** Flask backend.

### Frontend (Vanilla JS + CSS Modules)

- **Styles**: Always use the modular CSS system.
  - `vars.css`: CSS variables and design tokens.
  - `base.css`: Global resets and typography.
  - `layout.css`: Structural elements (Nav, Hero, Footer).
  - `components.css`: Reusable UI elements (Buttons, Cards).
  - `animations.css`: Keyframes and reveal utilities.
  - `modules.css`: Complex feature-specific designs.
- **Scripts**: 
  - Use ES Modules (`import`/`export`).
  - Follow the `AppController` pattern for main page logic.
  - Use classes for feature modules (e.g., `ZenithLab`, `QuantumForge`).
  - **JSDoc is mandatory** for all new functions and classes.

### Backend (Flask + SQLAlchemy)

- **Models**: Located in `backend/models.py`. Always include type hints for `to_dict()` methods.
- **Routes**: Define endpoints with clear return type hints (e.g., `Tuple[Response, int]`).
- **Logic**: Keep the `agent/` directory as the core intelligence layer.

## Development Workflow

1.  **Style Changes**: Do not add styles directly to `styles.css`. Instead, find the appropriate module or create a new one and `@import` it in `styles.css`.
2.  **State Management**: Use the `AppController` instance (globally accessible via `window.app`) to manage application-wide state if necessary.
3.  **Documentation**: Use Google-style docstrings for Python and JSDoc for JavaScript.

## Accessibility (a11y)

All interactive elements must have:
- Descriptive `aria-label` attributes.
- Keyboard focus indicators.
- Appropriate semantic HTML tags.

---
*Reclaim your time. Master your goals.*
