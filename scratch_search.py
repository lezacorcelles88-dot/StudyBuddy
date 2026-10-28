with open('templates/dashboard.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if any(term in line.lower() for term in ['view-materials', 'view-questions', 'modal-upload', 'scan-to-reviewer', 'notescanner', 'uploadmodal', 'uploadfile']):
            print(f"{i}: {line.strip()[:100]}")
