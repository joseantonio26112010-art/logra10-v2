import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "es" | "en";
const KEY = "logra10:lang";

const dict = {
  es: {
    // nav / chrome
    nav_home: "Inicio",
    nav_notes: "Notas",
    nav_classes: "Clases",
    nav_conversion: "Conversión",

    // conversion
    conv_heading: "Conversión de apuntes",
    conv_subtitle: "Sube tus apuntes en PNG, JPG o PDF y la IA los convertirá en preguntas y respuestas listas para estudiar. Exporta el resultado en PDF o DOCX.",
    conv_upload_cta: "Haz clic aquí o arrastra tus apuntes",
    conv_upload_help: "Acepta PDF, PNG y JPG. Puedes combinar varios archivos.",
    conv_considerations_placeholder: "Ej.: De este PDF solo el tema 2. Ignora encabezados y pies. Céntrate en las definiciones.",
    conv_run_btn: "Convertir apuntes",
    conv_ai_converting: "La IA está convirtiendo tus apuntes…",
    conv_err_add_files: "Añade al menos un PDF o imagen.",
    conv_err_no_pairs: "La IA no consiguió generar preguntas a partir de los apuntes.",
    conv_done: "Se generaron {n} preguntas",
    conv_pairs_count: "{n} preguntas generadas",
    conv_title_label: "Título",
    conv_export_pdf: "Exportar PDF",
    conv_export_docx: "Exportar DOCX",
    footer: "Logra10©2026 · Tú eres quien decide la nota que quieres sacar",
    lang_label: "Cambiar idioma",
    theme_label: "Cambiar tema",
    back_home: "Volver al inicio",
    exit: "Salir",

    // home (index)
    home_title_a: "Convierte tus apuntes en un",
    home_title_b: "examen inteligente",
    home_subtitle:
      "Sube PDFs o imágenes (PNG, JPG…) con tus preguntas y respuestas. La IA las extrae y te corrige de forma semántica, detectando errores factuales y datos que faltan.",
    upload_cta: "Haz clic aquí o arrastra tus PDFs e imágenes",
    upload_help: "Acepta PDF, PNG, JPG, WEBP. Puedes combinar varios archivos.",
    considerations_label: "Consideraciones al cargar",
    optional: "(opcional)",
    considerations_placeholder:
      "Ej.: Del PDF solo las 4 primeras páginas. De las imágenes, analiza la columna izquierda. Ignora encabezados y pies de página.",
    considerations_help:
      "Estas instrucciones guían a la IA al analizar tus archivos. Puedes dejarlo vacío.",
    analyze_btn: "Analizar y extraer preguntas",
    processing: "Procesando…",
    reading_docs: "Leyendo documentos…",
    ai_extracting: "La IA está extrayendo preguntas y respuestas…",
    processing_graphics: "Procesando respuestas gráficas…",
    err_add_files: "Añade al menos un archivo o imagen.",
    err_no_pairs: "No se detectaron pares pregunta/respuesta.",
    err_processing: "Error procesando el archivo",
    extracted_n_questions: "Se extrajeron {n} preguntas",
    questions_count: "{n} preguntas",
    your_temarios: "Tus temarios",
    study_btn: "Estudiar",
    exam_btn: "Examinar",
    image_kind: "Imagen",
    pdf_kind: "PDF",
    text_kind: "Texto",

    // study
    title_study: "Estudiar — Logra10",
    no_active_temario: "No hay temario activo",
    empty_state_help: "Sube un PDF en la pantalla de inicio para empezar.",
    completed_temario: "¡Has completado el temario! 🎉",
    review_again: "Repasar de nuevo",
    back_menu: "Volver al menú principal",
    question_n_of: "Pregunta {i} de {n}",
    write_answer: "Escribe tu respuesta…",
    original_answer: "Respuesta original",
    correct: "Corregir",
    show_answer: "Mostrar respuesta",
    hide_answer: "Ocultar respuesta",
    consult_sources: "Consultar apuntes cargados",
    no_sources: "No hay apuntes originales guardados",
    open_sources: "Abrir apuntes originales",
    next: "Siguiente",
    repeat_question: "Repetir pregunta",
    your_answer: "Tu respuesta",
    accuracy: "Acierto factual",
    coverage: "Cobertura",
    errors_detected: "Errores detectados",
    info_missing: "Información que falta",
    correct_label: "correcto",
    err_write_first: "Escribe tu respuesta primero",
    err_correction: "Error en la corrección",

    // exam
    title_exam: "Examen — Logra10",
    exam_mode: "Modo examen",
    finish_exam: "Finalizar examen",
    exam_results: "Resultados del examen",
    global_grade: "Nota global / 10",
    avg_accuracy: "Acierto medio",
    avg_coverage: "Cobertura media",
    best_mastered: "Mejor dominadas",
    weakest: "Preguntas más débiles",
    err_write_answer: "Escribe tu respuesta",
    err_correcting: "Error corrigiendo",

    // notes
    title_notes: "Notas — Logra10",
    notes_heading: "Notas",
    notes_subtitle: "Gestiona tus calificaciones académicas.",
    add_row: "Añadir fila",
    th_subject: "Asignatura",
    th_content: "Contenido",
    th_date: "Fecha",
    th_grade: "Calificación",
    no_notes: "No hay notas aún. Pulsa \"Añadir fila\".",
    calculate: "CALCULAR",
    which_subject: "¿De qué asignatura deseas calcular la media?",
    select_subject: "Selecciona una asignatura",
    subject_label: "Asignatura",
    grades_used: "Notas usadas",
    arithmetic_mean: "Media aritmética sobre las calificaciones numéricas.",
    close: "Cerrar",
    calculate_mean: "Calcular media",

    // classes
    title_classes: "Clases — Logra10",
    classes_heading: "Clases",
    classes_subtitle:
      "Convierte la transcripción de una clase en apuntes optimizados.",
    transcription_label: "Transcripción de la clase",
    transcription_placeholder:
      "Pega aquí la transcripción completa de la clase. Puede contener muletillas, repeticiones, errores… la IA los limpiará.",
    or_upload_txt: "O sube un archivo .txt",
    or_upload_audio: "O sube un audio",
    transcribing_audio: "Transcribiendo audio…",
    audio_transcribed: "Audio transcrito",
    err_transcription_failed: "No se pudo transcribir el audio",
    summarize_class: "Generar resumen de estudio",
    summarizing: "Generando resumen…",
    new_class: "Nueva clase",
    saved_classes: "Clases guardadas",
    no_classes_yet: "Todavía no tienes clases guardadas.",
    class_title_label: "Título de la clase",
    class_date_label: "Fecha",
    save_changes: "Guardar cambios",
    delete: "Eliminar",
    edit: "Editar",
    open: "Abrir",
    err_empty_transcription: "Pega o sube una transcripción primero.",
    class_saved: "Resumen guardado",
    confirm_delete_class: "¿Eliminar este resumen?",

    // faq
    faq_title: "Información útil",
    faq_q1: "Qué hago si la IA no extrae bien la información",
    faq_a1: "Prueba a usar los siguientes operadores para afinar las instrucciones de carga: recopila, dentro, solo, a partir. Si aún así persiste, prueba a refrescar la web, reiniciar la app o a cambiar la instrucción por otra semejante.",
    faq_q2: "Por qué mi temario o mis notas han desaparecido",
    faq_a2: "Es posible que la base de datos se haya llenado y para evitar errores se haya liberado automáticamente la caché y otros archivos, eliminándose por error algún archivo útil. Se recomienda tener a su disposición los temarios y las notas antes de cargarlo en Logra10. No debe usarse esta aplicación con fines de almacenaje.",
    faq_q3: "La IA ha extraído el contenido de una pregunta de mi temario mal",
    faq_a3: "Aunque esto no sea frecuente, se puede dar el caso. Se recomienda importar apuntes limpios y claros para facilitar el trabajo de la IA y evitar errores.",
    faq_q4: "No me fío de la IA, cómo compruebo que las respuestas obtenidas son originales",
    faq_a4: "Hemos implementado en la sección de estudio la opción de 'Consultar apuntes', con ella podrá comprobar que nuestra IA no se ha equivocado.",
    faq_q5: "No estoy de acuerdo con la corrección de la IA",
    faq_a5: "Las correcciones de la IA se basan en los errores factuales y la información que no aparece en tu respuesta, comparando siempre la original.",
    faq_q6: "He creado mis apuntes a mi manera, pero no se importan bien",
    faq_a6: "Esta aplicación solo es compatible con tus apuntes si su formato es \"número-pregunta-respuesta\". Para transformar tus apuntes a este formato deberás hacerlo manualmente o en la sección de \"Conversión\". Si por ejemplo tus apuntes son resúmenes y esquemas, recopila la información que te debes saber y transfórmalo en preguntas y respuestas -si decides realizar el cambio manualmente-.",
    faq_q7: "¿Mis apuntes salen de mi dispositivo?",
    faq_a7: "No. Logra10 funciona sin conexión: la IA se ejecuta dentro de tu navegador y tus temarios, notas y clases se guardan solo en este dispositivo. Solo si activas la opción \"En la nube\" desde los ajustes de IA se enviará el contenido a un servicio externo para obtener más precisión.",
  },
  en: {
    nav_home: "Home",
    nav_notes: "Grades",
    nav_classes: "Classes",
    nav_conversion: "Conversion",

    // conversion
    conv_heading: "Notes conversion",
    conv_subtitle: "Upload your notes as PNG, JPG or PDF and the AI will turn them into ready-to-study questions and answers. Export the result as PDF or DOCX.",
    conv_upload_cta: "Click here or drag your notes",
    conv_upload_help: "Accepts PDF, PNG and JPG. You can combine several files.",
    conv_considerations_placeholder: "E.g.: From this PDF only topic 2. Ignore headers and footers. Focus on definitions.",
    conv_run_btn: "Convert notes",
    conv_ai_converting: "The AI is converting your notes…",
    conv_err_add_files: "Add at least one PDF or image.",
    conv_err_no_pairs: "The AI couldn't generate questions from the notes.",
    conv_done: "{n} questions generated",
    conv_pairs_count: "{n} questions generated",
    conv_title_label: "Title",
    conv_export_pdf: "Export PDF",
    conv_export_docx: "Export DOCX",
    footer: "Logra10©2026 · You decide the grade you want to achieve",
    lang_label: "Change language",
    theme_label: "Toggle theme",
    back_home: "Back to home",
    exit: "Exit",

    home_title_a: "Turn your notes into a",
    home_title_b: "smart exam",
    home_subtitle:
      "Upload PDFs or images (PNG, JPG…) with your questions and answers. The AI extracts them and grades you semantically, detecting factual errors and missing details.",
    upload_cta: "Click here or drag your PDFs and images",
    upload_help: "Accepts PDF, PNG, JPG, WEBP. You can combine several files.",
    considerations_label: "Loading considerations",
    optional: "(optional)",
    considerations_placeholder:
      "E.g.: From the PDF only the first 4 pages. From the images, analyze the left column. Ignore headers and footers.",
    considerations_help:
      "These instructions guide the AI when analyzing your files. You can leave it empty.",
    analyze_btn: "Analyze and extract questions",
    processing: "Processing…",
    reading_docs: "Reading documents…",
    ai_extracting: "The AI is extracting questions and answers…",
    processing_graphics: "Processing graphic answers…",
    err_add_files: "Add at least one file or image.",
    err_no_pairs: "No question/answer pairs detected.",
    err_processing: "Error processing the file",
    extracted_n_questions: "Extracted {n} questions",
    questions_count: "{n} questions",
    your_temarios: "Your topic sets",
    study_btn: "Study",
    exam_btn: "Take exam",
    image_kind: "Image",
    pdf_kind: "PDF",
    text_kind: "Text",

    title_study: "Study — Logra10",
    no_active_temario: "No active topic set",
    empty_state_help: "Upload a PDF on the home screen to get started.",
    completed_temario: "You completed the set! 🎉",
    review_again: "Review again",
    back_menu: "Back to main menu",
    question_n_of: "Question {i} of {n}",
    write_answer: "Write your answer…",
    original_answer: "Original answer",
    correct: "Grade",
    show_answer: "Show answer",
    hide_answer: "Hide answer",
    consult_sources: "Open original notes",
    no_sources: "No original notes saved",
    open_sources: "Open original notes",
    next: "Next",
    repeat_question: "Repeat question",
    your_answer: "Your answer",
    accuracy: "Factual accuracy",
    coverage: "Coverage",
    errors_detected: "Errors detected",
    info_missing: "Missing information",
    correct_label: "correct",
    err_write_first: "Write your answer first",
    err_correction: "Grading error",

    title_exam: "Exam — Logra10",
    exam_mode: "Exam mode",
    finish_exam: "Finish exam",
    exam_results: "Exam results",
    global_grade: "Overall grade / 10",
    avg_accuracy: "Average accuracy",
    avg_coverage: "Average coverage",
    best_mastered: "Best mastered",
    weakest: "Weakest questions",
    err_write_answer: "Write your answer",
    err_correcting: "Grading error",

    title_notes: "Grades — Logra10",
    notes_heading: "Grades",
    notes_subtitle: "Track your academic grades.",
    add_row: "Add row",
    th_subject: "Subject",
    th_content: "Content",
    th_date: "Date",
    th_grade: "Grade",
    no_notes: "No grades yet. Click \"Add row\".",
    calculate: "CALCULATE",
    which_subject: "Which subject do you want to average?",
    select_subject: "Select a subject",
    subject_label: "Subject",
    grades_used: "Grades used",
    arithmetic_mean: "Arithmetic mean of the numeric grades.",
    close: "Close",
    calculate_mean: "Calculate average",

    title_classes: "Classes — Logra10",
    classes_heading: "Classes",
    classes_subtitle:
      "Turn a class transcription into optimized study notes.",
    transcription_label: "Class transcription",
    transcription_placeholder:
      "Paste the full class transcription here. It can have filler words, repetitions, errors… the AI will clean them.",
    or_upload_txt: "Or upload a .txt file",
    or_upload_audio: "Or upload an audio file",
    transcribing_audio: "Transcribing audio…",
    audio_transcribed: "Audio transcribed",
    err_transcription_failed: "Could not transcribe the audio",
    summarize_class: "Generate study summary",
    summarizing: "Generating summary…",
    new_class: "New class",
    saved_classes: "Saved classes",
    no_classes_yet: "You don't have any saved classes yet.",
    class_title_label: "Class title",
    class_date_label: "Date",
    save_changes: "Save changes",
    delete: "Delete",
    edit: "Edit",
    open: "Open",
    err_empty_transcription: "Paste or upload a transcription first.",
    class_saved: "Summary saved",
    confirm_delete_class: "Delete this summary?",

    // faq
    faq_title: "Useful information",
    faq_q1: "What do I do if the AI doesn't extract information well",
    faq_a1: "Try using the following operators to fine-tune loading instructions: collect, within, only, from. If it persists, try refreshing the web, restarting the app, or changing the instruction to a similar one.",
    faq_q2: "Why have my topic sets or notes disappeared",
    faq_a2: "It's possible that the database filled up and to avoid errors the cache and other files were automatically freed, accidentally deleting some useful file. We recommend having your topic sets and notes available before uploading them to Logra10. This application should not be used for storage purposes.",
    faq_q3: "The AI extracted a question from my topic set incorrectly",
    faq_a3: "Although this is not frequent, it can happen. We recommend importing clean and clear notes to facilitate the AI's work and avoid errors.",
    faq_q4: "I don't trust the AI, how do I check that the answers obtained are original",
    faq_a4: "We have implemented in the study section the option to 'Consult notes', with it you can check that our AI has not made a mistake.",
    faq_q5: "I don't agree with the AI's correction",
    faq_a5: "The AI's corrections are based on factual errors and information that does not appear in your answer, always comparing with the original. If the AI fails in this, contact support so we can carry out optimization and review.",
    faq_q6: "I've created my notes my own way, but they don't import well",
    faq_a6: "This application is only compatible with your notes if their format is \"number-question-answer\". To transform your notes to this format you'll need to do it manually. If for example your notes are summaries and outlines, gather the information you need to know and transform it into questions and answers.",
    faq_q7: "Do my notes leave my device?",
    faq_a7: "No. Logra10 works offline: the AI runs inside your browser and your subjects, notes and classes are stored only on this device. Only if you switch on the \"cloud\" option in the AI settings is your content sent to an external service for extra accuracy.",
  },
} as const;

type Key = keyof typeof dict["es"];

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
}>({
  lang: "es",
  setLang: () => {},
  t: (k) => dict.es[k],
});

function format(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved === "es" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }

  const t = (k: Key, vars?: Record<string, string | number>) =>
    format(dict[lang][k] ?? dict.es[k], vars);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
