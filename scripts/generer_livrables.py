"""Generation des livrables de documentation SIGTB (D-092, phase 3).

Lancement depuis la racine du depot :  python -I scripts/generer_livrables.py
Outils : openpyxl, python-docx, reportlab (aucune dependance npm).
Sortie : docs/livrables/. Les renvois « capture a venir » restent en texte.
"""
import csv
import datetime
import os
import re
import site
import subprocess
import sys

# python -I ignore le site utilisateur, ou les outils sont installes : on l'ajoute
# en fin de chemin (il ne masque donc aucun module de la bibliotheque standard).
if site.getusersitepackages() not in sys.path:
    sys.path.append(site.getusersitepackages())

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, Preformatted, Spacer, Table,
                                TableStyle)
from reportlab.platypus.doctemplate import BaseDocTemplate, Frame, PageTemplate
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'docs', 'livrables')

DOCUMENTS = [
    ('docs/user-manual/SIGTB_MANUEL_GENERAL_UTILISATEUR.md', 'SIGTB_MANUEL_GENERAL_UTILISATEUR', True),
    ('docs/functional-circuits/SIGTB_GUIDE_CIRCUITS_OPERATIONNELS.md', 'SIGTB_GUIDE_CIRCUITS_OPERATIONNELS', False),
    ('docs/admin-manual/SIGTB_MANUEL_ADMINISTRATEUR.md', 'SIGTB_MANUEL_ADMINISTRATEUR', False),
    ('docs/training/SIGTB_GUIDE_PRISE_EN_MAIN_AUTONOME.md', 'SIGTB_GUIDE_PRISE_EN_MAIN_AUTONOME', False),
    ('docs/training/CORRIGES.md', 'SIGTB_GUIDE_PRISE_EN_MAIN_CORRIGES', False),
    ('docs/faq/SIGTB_FAQ_UTILISATEURS.md', 'SIGTB_FAQ_UTILISATEURS', False),
    ('docs/glossary/SIGTB_GLOSSAIRE.md', 'SIGTB_GLOSSAIRE', False),
]
CSV_CATALOGUE = 'docs/user-manual/SIGTB_CATALOGUE_MODULES_ET_FONCTIONNALITES.csv'


def version():
    try:
        sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=RACINE, capture_output=True, text=True).stdout.strip()
    except OSError:
        sha = 'inconnu'
    date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    return sha or 'inconnu', date


# ---------------------------------------------------------------- Markdown

def blocs(texte):
    """Decoupe un Markdown simple en blocs (titre, para, liste, table, code, citation, regle)."""
    lignes = texte.replace('\r\n', '\n').split('\n')
    i = 0
    while i < len(lignes):
        l = lignes[i]
        if l.startswith('```'):
            langue = l[3:].strip()
            j = i + 1
            corps = []
            while j < len(lignes) and not lignes[j].startswith('```'):
                corps.append(lignes[j])
                j += 1
            yield ('code', langue, '\n'.join(corps))
            i = j + 1
            continue
        m = re.match(r'^(#{1,6})\s+(.*)$', l)
        if m:
            yield ('titre', len(m.group(1)), m.group(2).strip())
            i += 1
            continue
        if l.strip() in ('---', '***'):
            yield ('regle', None, None)
            i += 1
            continue
        if l.lstrip().startswith('|'):
            rangs = []
            while i < len(lignes) and lignes[i].lstrip().startswith('|'):
                cellules = [c.strip() for c in lignes[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{2,}:?', c) for c in cellules if c):
                    rangs.append(cellules)
                i += 1
            yield ('table', None, rangs)
            continue
        if re.match(r'^\s*([-*]|\d+\.)\s+', l):
            items = []
            while i < len(lignes) and re.match(r'^\s*([-*]|\d+\.)\s+', lignes[i]):
                items.append(re.sub(r'^\s*([-*]|\d+\.)\s+', '', lignes[i]))
                i += 1
            yield ('liste', None, items)
            continue
        if l.startswith('>'):
            corps = []
            while i < len(lignes) and lignes[i].startswith('>'):
                corps.append(lignes[i].lstrip('>').strip())
                i += 1
            yield ('citation', None, ' '.join(corps))
            continue
        if not l.strip():
            i += 1
            continue
        corps = [l]
        i += 1
        while i < len(lignes) and lignes[i].strip() and not re.match(r'^(#{1,6}\s|```|\s*\||\s*([-*]|\d+\.)\s|>)', lignes[i]):
            corps.append(lignes[i])
            i += 1
        yield ('para', None, ' '.join(s.strip() for s in corps))


def segments(texte):
    """Segments en ligne : (texte, gras, code). Liens [a](b) rendus « a »."""
    texte = re.sub(r'!\[([^\]]*)\]\([^)]*\)', r'\1', texte)
    texte = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', texte)
    out = []
    for morceau in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', texte):
        if not morceau:
            continue
        if morceau.startswith('**') and morceau.endswith('**'):
            out.append((morceau[2:-2], True, False))
        elif morceau.startswith('`') and morceau.endswith('`'):
            out.append((morceau[1:-1], False, True))
        else:
            out.append((morceau.replace('*', ''), False, False))
    return out


def texte_brut(texte):
    return ''.join(s for s, _, _ in segments(texte))


# ---------------------------------------------------------------- PDF

POLICE, POLICE_GRAS, POLICE_MONO = 'Helvetica', 'Helvetica-Bold', 'Courier'


def polices():
    global POLICE, POLICE_GRAS, POLICE_MONO
    rep = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
    candidats = [('arial.ttf', 'arialbd.ttf', 'consola.ttf'), ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf')]
    for normal, gras, mono in candidats:
        chemins = [os.path.join(rep, f) for f in (normal, gras, mono)]
        if all(os.path.exists(c) for c in chemins):
            pdfmetrics.registerFont(TTFont('SigtbN', chemins[0]))
            pdfmetrics.registerFont(TTFont('SigtbB', chemins[1]))
            pdfmetrics.registerFont(TTFont('SigtbM', chemins[2]))
            pdfmetrics.registerFontFamily('SigtbN', normal='SigtbN', bold='SigtbB', italic='SigtbN', boldItalic='SigtbB')
            POLICE, POLICE_GRAS, POLICE_MONO = 'SigtbN', 'SigtbB', 'SigtbM'
            return


def xml(texte):
    out = []
    for s, gras, code in segments(texte):
        s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        if gras:
            out.append(f'<b>{s}</b>')
        elif code:
            out.append(f'<font face="{POLICE_MONO}">{s}</font>')
        else:
            out.append(s)
    return ''.join(out)


class Gabarit(BaseDocTemplate):
    def __init__(self, chemin, titre, **kw):
        super().__init__(chemin, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
                         title=titre, author='SIGTB', **kw)
        cadre = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('p', [cadre], onPage=self.pied)])
        self.titre_doc = titre

    def pied(self, canvas, doc):
        canvas.saveState()
        canvas.setFont(POLICE, 8)
        canvas.setFillColor(colors.grey)
        if doc.page > 1:
            canvas.drawString(2 * cm, 1.2 * cm, self.titre_doc)
        canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f'Page {doc.page}')
        canvas.restoreState()

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and getattr(f, 'niveau_toc', None) is not None:
            cle = f'h{id(f)}'
            self.canv.bookmarkPage(cle)
            self.notify('TOCEntry', (f.niveau_toc, f.getPlainText(), self.page, cle))


def styles_pdf():
    base = getSampleStyleSheet()
    st = {
        'corps': ParagraphStyle('corps', parent=base['Normal'], fontName=POLICE, fontSize=9.5, leading=13, spaceAfter=5),
        'cellule': ParagraphStyle('cellule', parent=base['Normal'], fontName=POLICE, fontSize=7.5, leading=9.5),
        'code': ParagraphStyle('code', parent=base['Code'], fontName=POLICE_MONO, fontSize=7, leading=8.5, backColor=colors.HexColor('#f4f1ee')),
        'citation': ParagraphStyle('citation', parent=base['Normal'], fontName=POLICE, fontSize=9, leading=12, leftIndent=12,
                                   textColor=colors.HexColor('#5a4a3f'), backColor=colors.HexColor('#faf6f2'), borderPadding=4, spaceAfter=6),
        'titre_page': ParagraphStyle('tp', fontName=POLICE_GRAS, fontSize=24, leading=30, alignment=TA_CENTER, textColor=colors.HexColor('#7c2d12')),
        'sous_titre': ParagraphStyle('st', fontName=POLICE, fontSize=11, leading=16, alignment=TA_CENTER),
    }
    tailles = {1: 16, 2: 13.5, 3: 11.5, 4: 10.5, 5: 10, 6: 10}
    for n, t in tailles.items():
        st[f'h{n}'] = ParagraphStyle(f'h{n}', fontName=POLICE_GRAS, fontSize=t, leading=t * 1.3, spaceBefore=10 if n > 1 else 4,
                                     spaceAfter=5, textColor=colors.HexColor('#7c2d12' if n <= 2 else '#3b2a20'), keepWithNext=True)
    return st


def table_pdf(rangs, st, largeur):
    if not rangs:
        return Spacer(1, 1)
    n = max(len(r) for r in rangs)
    donnees = [[Paragraph(xml(c), st['cellule']) for c in r + [''] * (n - len(r))] for r in rangs]
    t = Table(donnees, colWidths=[largeur / n] * n, repeatRows=1)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#c9bfb6')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3e8df')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def pdf(md, chemin, titre, sha, date):
    st = styles_pdf()
    doc = Gabarit(chemin, titre)
    elems = [Spacer(1, 6 * cm), Paragraph('SIGTB', st['sous_titre']), Spacer(1, 0.4 * cm), Paragraph(xml(titre), st['titre_page']),
             Spacer(1, 1.2 * cm), Paragraph(f'Version documentée : {sha}', st['sous_titre']),
             Paragraph(f'Date de génération : {date}', st['sous_titre']),
             Spacer(1, 0.6 * cm), Paragraph('Les figures notées « capture à venir » seront ajoutées avec les captures d\'écran.', st['sous_titre']),
             PageBreak(), Paragraph('Sommaire', st['h1'])]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('t1', fontName=POLICE_GRAS, fontSize=9.5, leading=12, leftIndent=0),
                       ParagraphStyle('t2', fontName=POLICE, fontSize=8.5, leading=11, leftIndent=14)]
    elems += [toc, PageBreak()]
    premier = True
    for genre, a, b in blocs(md):
        if genre == 'titre':
            if a == 1 and premier:
                premier = False
                continue
            p = Paragraph(xml(b), st[f'h{min(a, 6)}'])
            if a <= 2:
                p.niveau_toc = 0
            elems.append(p)
        elif genre == 'para':
            elems.append(Paragraph(xml(b), st['corps']))
        elif genre == 'liste':
            for it in b:
                elems.append(Paragraph(xml(it), st['corps'], bulletText='•'))
        elif genre == 'citation':
            elems.append(Paragraph(xml(b), st['citation']))
        elif genre == 'table':
            elems.append(table_pdf(b, st, doc.width))
            elems.append(Spacer(1, 6))
        elif genre == 'code':
            entete = 'Schéma Mermaid (rendu textuel)' if a == 'mermaid' else 'Code'
            elems.append(KeepTogether([Paragraph(f'<i>{entete}</i>', st['corps']), Preformatted(b, st['code'])]))
        elif genre == 'regle':
            elems.append(Spacer(1, 6))
    doc.multiBuild(elems)


# ---------------------------------------------------------------- DOCX

def champ(paragraphe, instruction):
    run = paragraphe.add_run()
    for genre, val in (('begin', None), ('instr', instruction), ('separate', None), ('end', None)):
        if genre == 'instr':
            e = OxmlElement('w:instrText')
            e.set(qn('xml:space'), 'preserve')
            e.text = val
        else:
            e = OxmlElement('w:fldChar')
            e.set(qn('w:fldCharType'), genre)
        run._r.append(e)


def ajouter(paragraphe, texte):
    for s, gras, code in segments(texte):
        r = paragraphe.add_run(s)
        r.bold = gras
        if code:
            r.font.name = 'Consolas'
            r.font.size = Pt(9)


def docx(md, chemin, titre, sha, date):
    d = Document()
    d.styles['Normal'].font.name = 'Calibri'
    d.styles['Normal'].font.size = Pt(10.5)
    for _ in range(8):
        d.add_paragraph()
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(titre)
    r.bold = True
    r.font.size = Pt(26)
    r.font.color.rgb = RGBColor(0x7C, 0x2D, 0x12)
    for ligne in (f'Version documentée : {sha}', f'Date de génération : {date}',
                  'Les figures notées « capture à venir » seront ajoutées avec les captures d\'écran.'):
        q = d.add_paragraph(ligne)
        q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_page_break()
    d.add_heading('Sommaire', level=1)
    champ(d.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u')
    d.add_paragraph('Sommaire : clic droit, Mettre à jour le champ, à la première ouverture dans Word.')
    d.add_page_break()
    pied = d.sections[0].footer.paragraphs[0]
    pied.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pied.add_run(f'{titre}    Page ')
    champ(pied, 'PAGE')
    premier = True
    for genre, a, b in blocs(md):
        if genre == 'titre':
            if a == 1 and premier:
                premier = False
                continue
            d.add_heading(texte_brut(b), level=min(a, 4))
        elif genre == 'para':
            ajouter(d.add_paragraph(), b)
        elif genre == 'liste':
            for it in b:
                ajouter(d.add_paragraph(style='List Bullet'), it)
        elif genre == 'citation':
            ajouter(d.add_paragraph(style='Intense Quote'), b)
        elif genre == 'table' and b:
            n = max(len(x) for x in b)
            t = d.add_table(rows=len(b), cols=n)
            t.style = 'Table Grid'
            for i, rang in enumerate(b):
                for j in range(n):
                    cel = t.cell(i, j)
                    cel.paragraphs[0].text = ''
                    ajouter(cel.paragraphs[0], rang[j] if j < len(rang) else '')
                    for run in cel.paragraphs[0].runs:
                        run.font.size = Pt(8)
                        if i == 0:
                            run.bold = True
            d.add_paragraph()
        elif genre == 'code':
            q = d.add_paragraph()
            r = q.add_run(b)
            r.font.name = 'Consolas'
            r.font.size = Pt(8)
    d.save(chemin)


# ---------------------------------------------------------------- XLSX

def xlsx(chemin, sha, date):
    with open(os.path.join(RACINE, CSV_CATALOGUE), encoding='utf-8') as f:
        rangs = [r for r in csv.reader(f, delimiter=';') if r]
    wb = Workbook()
    ws = wb.active
    ws.title = 'Catalogue'
    for r in rangs:
        ws.append(r)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='7C2D12')
        c.alignment = Alignment(wrap_text=True, vertical='top')
    largeurs = [18, 48, 30, 26, 22, 48, 18, 18, 36]
    for i in range(1, ws.max_column + 1):
        ws.column_dimensions[get_column_letter(i)].width = largeurs[i - 1] if i <= len(largeurs) else 20
    for ligne in ws.iter_rows(min_row=2):
        for c in ligne:
            c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.auto_filter.ref = ws.dimensions
    ws.freeze_panes = 'A2'
    info = wb.create_sheet('Version')
    for r in (('Document', 'Catalogue des modules et fonctionnalités SIGTB'), ('Version documentée', sha), ('Date de génération', date),
              ('Source', CSV_CATALOGUE), ('Fonctionnalités', len(rangs) - 1)):
        info.append(r)
    info.column_dimensions['A'].width = 22
    info.column_dimensions['B'].width = 70
    wb.save(chemin)


def main():
    os.makedirs(SORTIE, exist_ok=True)
    polices()
    sha, date = version()
    cible = os.path.join(SORTIE, 'SIGTB_CATALOGUE_MODULES_ET_FONCTIONNALITES.xlsx')
    xlsx(cible, sha, date)
    print('ecrit', cible)
    for source, nom, avec_docx in DOCUMENTS:
        with open(os.path.join(RACINE, source), encoding='utf-8') as f:
            md = f.read()
        m = re.search(r'^#\s+(.+)$', md, re.M)
        titre = texte_brut(m.group(1)) if m else nom
        if avec_docx:
            docx(md, os.path.join(SORTIE, nom + '.docx'), titre, sha, date)
            print('ecrit', nom + '.docx')
        pdf(md, os.path.join(SORTIE, nom + '.pdf'), titre, sha, date)
        print('ecrit', nom + '.pdf')
    return 0


if __name__ == '__main__':
    sys.exit(main())
