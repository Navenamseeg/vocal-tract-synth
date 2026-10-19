# Builds the browser page (web/vocal-tract-synth.html) and the plugin page (ui/index.html) from web/src.
import os, re
here = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(here, 'src', f)).read()
t = src('template.html')
e = src('engine.js').replace("if (typeof module !== 'undefined') module.exports = EngineFactory;\n", "")
l = src('lyrics.js').replace("if (typeof module !== 'undefined') module.exports = LyricsFactory;\n", "")
page = t.replace('/*@ENGINE@*/', e).replace('/*@LYRICS@*/', l)
open(os.path.join(here, 'vocal-tract-synth.html'), 'w').write(page)
frag = page.replace('<meta charset="utf-8">\n', '', 1)
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
       '<style>html,body{margin:0}body{font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + frag + '\n</body>\n</html>\n')
os.makedirs(os.path.join(here, '..', 'ui'), exist_ok=True)
open(os.path.join(here, '..', 'ui', 'index.html'), 'w').write(doc)
print('built web page and plugin UI')
