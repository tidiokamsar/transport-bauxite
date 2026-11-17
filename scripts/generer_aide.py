"""Centre d'aide integre (D-092, phase 3) : HTML statiques dans public/aide/.

Lancement depuis la racine du depot :  python -I scripts/generer_aide.py
Un fichier par chapitre du manuel general (nom = module), plus FAQ, glossaire,
circuits, prise en main, et un index avec recherche cote client. Aucun secret,
aucune adresse de serveur : seuls les manuels de docs/ sont repris.
La correspondance vue -> page est dans src/components/Aide/aide.ts.
"""
import html
import importlib.util
import json
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'public', 'aide')

_spec = importlib.util.spec_from_file_location('livrables', os.path.join(RACINE, 'scripts', 'generer_livrables.py'))
livrables = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(livrables)

# Chapitre du manuel general -> nom de page (repris par aide.ts).
CHAPITRES = {
    1: 'presentation', 2: 'acces', 3: 'interface', 4: 'tableau-de-bord', 5: 'validations', 6: 'decisions', 7: 'sites',
    8: 'shifts', 9: 'planification', 10: 'postes', 11: 'dispatch', 12: 'voyages', 13: 'kilometrage', 14: 'fiches',
    15: 'pesee-cbg', 16: 'operations-transport', 17: 'vehicules', 18: 'chauffeurs', 19: 'documents', 20: 'carburant',
    21: 'maintenance', 22: 'pneus', 23: 'stocks', 24: 'achats', 25: 'fournisseurs', 26: 'moyens-generaux', 27: 'contrats',
    28: 'facturation', 29: 'finance', 30: 'hse', 31: 'rh', 32: 'reporting', 33: 'gps-capteurs', 34: 'parametres',
    35: 'a-developper',
}
AUTRES = [
    ('docs/faq/SIGTB_FAQ_UTILISATEURS.md', 'faq', 'Questions fréquentes'),
    ('docs/glossary/SIGTB_GLOSSAIRE.md', 'glossaire', 'Glossaire'),
    ('docs/functional-circuits/SIGTB_GUIDE_CIRCUITS_OPERATIONNELS.md', 'circuits', 'Circuits opérationnels'),
    ('docs/training/SIGTB_GUIDE_PRISE_EN_MAIN_AUTONOME.md', 'prise-en-main', 'Prise en main autonome'),
]

STYLE = """
:root{--fond:#faf7f4;--texte:#2b211b;--accent:#7c2d12;--bord:#e5dcd4;--doux:#6b5b50}
@media (prefers-color-scheme:dark){:root{--fond:#1a1411;--texte:#efe7e1;--accent:#f0a070;--bord:#3a2e27;--doux:#b8a89c}}
*{box-sizing:border-box}body{margin:0;background:var(--fond);color:var(--texte);font:15px/1.55 system-ui,sans-serif}
header{border-bottom:1px solid var(--bord);padding:12px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}
header a{color:var(--accent);font-weight:600;text-decoration:none}main{max-width:960px;margin:0 auto;padding:16px}
h1,h2,h3{color:var(--accent);line-height:1.25}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:13px}
td,th{border:1px solid var(--bord);padding:4px 6px;vertical-align:top;text-align:left}th{background:rgba(124,45,18,.08)}
code,pre{font-family:Consolas,monospace;font-size:12.5px}pre{overflow-x:auto;border:1px solid var(--bord);padding:8px}
blockquote{margin:0;border-left:4px solid var(--accent);padding:4px 12px;color:var(--doux)}
input{width:100%;padding:10px;font-size:15px;border:1px solid var(--bord);border-radius:8px;background:transparent;color:inherit}
.res a{display:block;padding:6px 0;color:var(--accent)}.res small{color:var(--doux)}
"""


def ligne(texte):
    out = []
    for s, gras, code in livrables.segments(texte):
        s = html.escape(s)
        out.append(f'<b>{s}</b>' if gras else f'<code>{s}</code>' if code else s)
    return ''.join(out)


def vers_html(md):
    out = []
    for genre, a, b in livrables.blocs(md):
        if genre == 'titre':
            out.append(f'<h{min(a, 6)}>{ligne(b)}</h{min(a, 6)}>')
        elif genre == 'para':
            out.append(f'<p>{ligne(b)}</p>')
        elif genre == 'liste':
            out.append('<ul>' + ''.join(f'<li>{ligne(x)}</li>' for x in b) + '</ul>')
        elif genre == 'citation':
            out.append(f'<blockquote>{ligne(b)}</blockquote>')
        elif genre == 'table' and b:
            tete, *corps = b
            out.append('<table><tr>' + ''.join(f'<th>{ligne(c)}</th>' for c in tete) + '</tr>'
                       + ''.join('<tr>' + ''.join(f'<td>{ligne(c)}</td>' for c in r) + '</tr>' for r in corps) + '</table>')
        elif genre == 'code':
            out.append(f'<pre>{html.escape(b)}</pre>')
    return '\n'.join(out)


def page(titre, corps, sha):
    return (f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{html.escape(titre)} : aide SIGTB</title><style>{STYLE}</style></head><body><header>'
            '<a href="index.html">Aide SIGTB</a><a href="faq.html">FAQ</a><a href="glossaire.html">Glossaire</a>'
            '<a href="circuits.html">Circuits</a><a href="prise-en-main.html">Prise en main</a></header>'
            f'<main>{corps}<hr><p><small>Version documentée : {html.escape(sha)}. Les figures notées « capture à venir » '
            'seront ajoutées avec les captures d\'écran.</small></p></main></body></html>')


def main():
    os.makedirs(SORTIE, exist_ok=True)
    sha, date = livrables.version()
    sha = f'{sha} ({date})'
    with open(os.path.join(RACINE, 'docs/user-manual/SIGTB_MANUEL_GENERAL_UTILISATEUR.md'), encoding='utf-8') as f:
        mgu = f.read().replace('\r\n', '\n')
    index = []
    morceaux = re.split(r'(?m)^(?=## \d+\. )', mgu)
    for m in morceaux:
        t = re.match(r'## (\d+)\. (.+)', m)
        if not t or int(t.group(1)) not in CHAPITRES:
            continue
        nom = CHAPITRES[int(t.group(1))]
        titre = f'{t.group(1)}. {t.group(2).strip()}'
        with open(os.path.join(SORTIE, nom + '.html'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(page(titre, vers_html(m), sha))
        index.append({'p': nom + '.html', 't': titre, 'x': livrables.texte_brut(re.sub(r'\s+', ' ', m))[:20000]})
    for source, nom, titre in AUTRES:
        with open(os.path.join(RACINE, source), encoding='utf-8') as f:
            md = f.read()
        with open(os.path.join(SORTIE, nom + '.html'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(page(titre, vers_html(md), sha))
        index.append({'p': nom + '.html', 't': titre, 'x': livrables.texte_brut(re.sub(r'\s+', ' ', md))[:40000]})
    liens = ''.join(f'<li><a href="{e["p"]}">{html.escape(e["t"])}</a></li>' for e in index)
    recherche = (
        '<h1>Centre d\'aide SIGTB</h1><p>Rechercher dans la documentation (sans accents ni majuscules).</p>'
        '<input id="q" type="search" placeholder="Exemple : ticket CBG, rechapage, motif" autofocus>'
        '<div id="r" class="res"></div><h2>Sommaire</h2><ul>' + liens + '</ul>'
        '<script>const I=' + json.dumps(index, ensure_ascii=False) + ';'
        'const n=s=>s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();'
        'const N=I.map(e=>n(e.x));const q=document.getElementById("q"),r=document.getElementById("r");'
        'q.addEventListener("input",()=>{const m=n(q.value.trim());r.textContent="";if(m.length<2)return;'
        'I.forEach((e,i)=>{const k=N[i].indexOf(m);if(k<0)return;const a=document.createElement("a");a.href=e.p;'
        'a.textContent=e.t;const s=document.createElement("small");s.textContent=" … "+e.x.slice(Math.max(0,k-60),k+100)+" …";'
        'a.appendChild(s);r.appendChild(a);});if(!r.firstChild)r.textContent="Aucun résultat.";});</script>')
    with open(os.path.join(SORTIE, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(page('Centre d\'aide', recherche, sha))
    print(len(index) + 1, 'pages dans', SORTIE)


if __name__ == '__main__':
    main()
