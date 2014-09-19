#!/bin/bash

if [ "$#" -ne "1" ]
then
	echo "You need to specity the url where the game will be published."
	exit
fi

url=$( ruby -ruri -e "print '$1'.to_s.chomp('/')" )
origin=$( ruby -ruri -e "print URI.join('$1', '/').to_s.chomp('/')" )
path=$( ruby -ruri -e "print URI.parse('$1').path.chomp('/')" )

[ -d dist ] || mkdir dist
[ -d tmp/packaged_app ] || mkdir -p tmp/packaged_app

## Icons
# Inkscape does not export grayscale png, pngcrush will
for S in 512 128 152 144 120 114 96 72
do
	inkscape -z -e tmp/icon-$S.png -w $S -h $S img/icon.svg
	pngcrush -brute -c 0 -q tmp/icon-$S.png dist/icon-$S.png
done

for S in 16 32 48 57
do
	inkscape -z -e tmp/icon-$S.png -w $S -h $S img/icon3.svg
	pngcrush -brute -c 4 -q -ow tmp/icon-$S.png
	convert tmp/icon-$S.png tmp/icon-$S.ico
done
convert tmp/icon-16.ico tmp/icon-32.ico tmp/icon-48.ico tmp/icon-57.ico dist/favicon.ico

## Add paragraph markup to license file
sed -e '/^\s*$/d' -e 's/^/<p>/g' -e 's/$/<\/p>/g' LICENSE > tmp/LICENSE

## For testing purpose, keep an online version of the game.
sed -e '/\$LICENSE\$/ {
r tmp/LICENSE
d
}' play.html > dist/play_online.html

## Build the offline app
cp app.css requestAnimationFrame.min.js stats.min.js observable.js canyoufillit.js canyoufillit_canvas_gui.js app.js .htaccess dist/
cp index.html bootstrap.css dist/
sed -e 's/<html>/<html manifest="cache.manifest">/g' dist/play_online.html > dist/play.html

# Compute a hash of all the files that need to be cached.
h=$(for f in app.css play.html requestAnimationFrame.min.js stats.min.js observable.js canyoufillit.js canyoufillit_canvas_gui.js app.js
do
	echo `sha1sum $f`
done|sha1sum|cut -d ' ' -f1)

# and put it in the cache manifest, in order to make it unique.
sed "s/# hash xyz/# hash $h/g" cache.manifest > dist/cache.manifest


## Build the hosted open web app manifest
sed "s!PATH!$path!g" manifest.webapp > dist/manifest.webapp

## Build the packaged open web app
cp dist/play_online.html tmp/packaged_app/play.html
cp app.css requestAnimationFrame.min.js stats.min.js observable.js canyoufillit.js canyoufillit_canvas_gui.js app.js tmp/packaged_app/
cp dist/icon-128.png dist/icon-512.png tmp/packaged_app/
sed -e "/appcache_path/d" -e "s!PATH!!g" manifest.webapp > tmp/packaged_app/manifest.webapp

zip dist/CanYouFillIt-WebApp.zip -j -r tmp/packaged_app

sed "s!URL!$url!g" package.webapp > dist/package.webapp

#rm -rf tmp
