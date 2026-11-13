# Builds index.html (the installable app) from page.html, the shared page body used by the Claude artifact.
import re
page = open('page.html', encoding='utf-8').read()
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Canon Only">'
        '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/deezy-192.png"><link rel="apple-touch-icon" href="icons/deezy-touch-180.png" sizes="180x180">'
        '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>')
open('index.html', 'w', encoding='utf-8').write(head + page + '</body></html>\n')
print('index.html written')
