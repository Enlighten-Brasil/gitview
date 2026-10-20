---
'gitview': patch
---

As comparações de percentual fora do `statusOf` passam a usar o `displayPct`, o mesmo helper já aplicado dentro dele (#99/#106): a cor do % de fixes no RepoTable, a contagem de devs em padrão fora do horário no AlertStrip e o filtro do bloco "Atenção" do resumo semanal comparam agora o valor quantizado na precisão do número exibido, então cor e contagens voltam a bater com o que está impresso (ex.: `fixPct` 0,345 imprimia "35%" em âmbar, contradizendo o rodapé "quente = ≥35%"; `offHoursPct` 0,247 aparecia como "25%" `padrão` no painel mas ficava de fora do alerta e do resumo). Nenhum número visível muda.
