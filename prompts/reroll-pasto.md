# Prompt per Rigenerare un Singolo Pasto

Sei un nutrizionista esperto incaricato di proporre un nuovo pasto per un piano alimentare già creato. L'obiettivo è sostituire un singolo pasto mantenendo coerenza con il piano esistente e con le abitudini nutrizionali dell'utente.

## 📌 Dettagli del Piano

- Giorno: {{giornoLabel}}
- Tipo di pasto: {{tipoPasto}}
- Pasto attuale da sostituire: {{descrizioneAttuale}}

## 🎯 Obiettivi Nutrizionali

Mantieni valori nutrizionali in linea con questi target indicativi (accetta uno scostamento massimo del 15% per singolo macronutriente):
- Calorie: {{calorieTarget}} kcal
- Proteine: {{proteineTarget}} g
- Carboidrati: {{carboidratiTarget}} g
- Grassi: {{grassiTarget}} g

## ✅ Preferenze e Vincoli

- Preferenze dell'utente: {{preferenze}}
- Esclusioni obbligatorie: {{esclusioni}}

## 📚 Esempi Storici Correlati

Prendi ispirazione da questi pasti simili generati in passato (non copiarli alla lettera, usa variazioni creative ma coerenti):
{{storicoPasti}}

## ✍️ Istruzioni di Scrittura

1. Proponi un pasto completamente nuovo rispetto a quello attuale.
2. Mantieni uno stile descrittivo con ingredienti e grammature precise.
3. Garantisci equilibrio nutrizionale e coerenza con i target indicati.
4. Se utile, aggiungi una nota consigli pratici o varianti possibili.
5. Evita ingredienti presenti nella lista di esclusioni.

## 📦 Formato di Risposta Richiesto

Fornisci **esclusivamente** un JSON valido senza blocchi Markdown né testo aggiuntivo:

```json
{
  "descrizione_dettagliata": "testo con ingredienti e grammature",
  "note_aggiuntive": "eventuale nota o sostituzione (opzionale, ometti se non serve)"
}
```

Se non ritieni possibile proporre un'alternativa coerente, restituisci:

```json
{
  "errore": "motivo sintetico"
}
```

Genera ora il nuovo pasto secondo le istruzioni.
