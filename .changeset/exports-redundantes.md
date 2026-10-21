---
"gitview": patch
---

Remove exports internos redundantes: 8 símbolos sem importadores externos viraram locais (HttpError, devOfEmail, WEEKDAYS, oklchToHex, isDarkTheme, windowLabel, ensureBoot, PR_REVIEW_STATES); resetThemeCache e invalidateStatus, sem uso algum, foram deletados; BRANCH_STATUSES segue exportado porque scripts/check-data.ts o importa.
