# LEADY

##Descripción del proyecto
El objetivo general es desarrollar una plataforma web con inteligencia artificial que conecte a jóvenes paraguayos con organizaciones, becas, programas de intercambio y voluntariados disponibles en el país, facilitando su acceso a oportunidades de liderazgo y participación social.

---

##Estructura del proyecto
/leady
├── backend
│ ├── pycache/
│ ├── .env
│ ├── database.py
│ └── main.py
│
├── frontend
│ ├── assets/
│ ├── css/
│ │ └── styles.css
│ │
│ ├── js/
│ │ ├── api.js
│ │ ├── auth.js
│ │ ├── dashboard.js
│ │ ├── opportunities.js
│ │ ├── opportunity-detail.js
│ │ ├── profile.js
│ │ └── recommendations.js
│ │
│ ├── dashboard.html
│ ├── index.html
│ ├── login.html
│ ├── register.html
│ ├── opportunities.html
│ ├── opportunity-detail.html
│ └── profile.html

##Tecnologías utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript (vanilla)

### Backend
- Python
- FastAPI

### Base de datos
- Supabase (PostgreSQL + Auth + API services)

---
##Cómo ejecutar el proyecto
### Backend (FastAPI)

1. Ir a la carpeta backend:
```bash
cd backend
Instalar dependencias:
pip install fastapi uvicorn supabase
Ejecutar servidor:
uvicorn main:app --reload

El backend se ejecuta en:

http://127.0.0.1:8000

Frontend

Abrir directamente:

frontend/index.html

o usar Live Server si estás en VSCode.

##Conexión backend ↔ frontend

El frontend consume la API del backend mediante api.js, que realiza solicitudes HTTP a FastAPI.

FastAPI maneja:

autenticación
lógica de negocio
comunicación con Supabase

##Notas importantes
Supabase actúa como backend de base de datos (PostgreSQL gestionado)
.env contiene credenciales sensibles (NO subir a GitHub)
El proyecto está modularizado por páginas en el frontend
La lógica de API está centralizada en api.js

##Funcionalidades principales
Registro de usuarios
Login y autenticación
Dashboard personalizado
Gestión de oportunidades
Vista detallada de oportunidades
Perfil de usuario
Sistema de recomendaciones

##Autor
Juan Carlos Velázquez

##Estado del proyecto

En desarrollo activo