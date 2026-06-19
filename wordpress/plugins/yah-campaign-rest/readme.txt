=== Yayasan Al-Hidayah — Campaign REST ===
Contributors: yayasanalhidayah
Tags: rest-api, donasiaja, campaign, headless
Requires at least: 5.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Exposes the donasiaja "campaign" post type over the WP REST API so the Astro
site (yayasanalhidayah.com) can sync live campaign data.

== Description ==

The donasiaja donation plugin registers its `campaign` post type with
show_in_rest = false, so it is invisible to the REST API. This plugin turns it
on at /wp-json/wp/v2/campaigns WITHOUT editing donasiaja (edits would be lost on
update), and adds a `meta_all` field carrying the campaign's post_meta
(target / raised / donatur) plus a `donasi_url` permalink field.

The Astro side reads this endpoint from an admin "Sync dari WP" action and
stores the numbers in Supabase; the public site renders from Supabase, never
scraping WordPress per request.

== Installation ==

1. WP Admin → Plugins → Add New → Upload Plugin.
2. Choose yah-campaign-rest.zip → Install Now → Activate.
3. Activation auto-flushes permalinks. The Plugins screen shows a status notice.
4. Verify: open /wp-json/wp/v2/campaigns — it should return JSON, not a 404.

If the notice says the CPT wasn't found: make sure donasiaja is active, then
Settings → Permalinks → Save. If donasiaja uses a non-"campaign" CPT slug, add
it to the CPTS list in yah-campaign-rest.php.

== Changelog ==

= 1.0.0 =
* Initial release. REST-enable campaign CPT, meta_all + donasi_url fields,
  activation permalink flush, admin status notice.
