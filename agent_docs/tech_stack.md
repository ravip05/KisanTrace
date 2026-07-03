# Tech Stack & Tools

- **Frontend:** React 19 (Vite) - PWA with Workbox
- **AI Inference:** LiteRT (formerly TFLite) via WASM (LiteRT.js)
- **Local Storage:** RxDB (IndexedDB wrapper)
- **Backend (Sync):** Node.js / Express
- **Database:** PostgreSQL (with Drizzle ORM)
- **ML Pipeline:** Python 3.11 / FastAPI (for IndiaAI Compute)
- **Styling:** CSS Modules / Vanilla CSS (Tailwind optional)

## Error Handling Pattern
```javascript
// Service-level error wrapper
export async function safeInference(imageData) {
  try {
    const result = await model.run(imageData);
    return { data: result, error: null };
  } catch (err) {
    console.error("Inference Error:", err);
    // Return user-friendly message for offline UI
    return { 
      data: null, 
      error: "Unable to analyze leaf. Please ensure phone is not too hot and try again." 
    };
  }
}
```

## Styling & Component Examples
```tsx
// Farmer-friendly button component
export const PrimaryButton = ({ label, onClick, icon }) => (
  <button 
    onClick={onClick}
    className={styles.primaryButton}
    aria-label={label}
  >
    {icon && <span className={styles.icon}>{icon}</span>}
    <span className={styles.label}>{label}</span>
  </button>
);
```
