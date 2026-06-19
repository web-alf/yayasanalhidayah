<?php
/**
 * Plugin Name:       Yayasan Al-Hidayah — REST-enable Campaign CPT
 * Plugin URI:        https://donasi.yayasanalhidayah.com
 * Description:       Exposes the donasiaja donation "campaign" post type via the WP REST API so the Astro site (yayasanalhidayah) can fetch live campaign data at /wp-json/wp/v2/campaigns. Must-use plugin — survives donasiaja updates.
 * Version:           1.0.0
 * Author:            Yayasan Al-Hidayah
 * License:           GPL-2.0-or-later
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   The donasiaja plugin (v2.x) registers its campaign post type with
 *   show_in_rest = false, so GET /wp-json/wp/v2/campaign returns 404. This
 *   mu-plugin flips it on WITHOUT editing the donasiaja plugin (edits would be
 *   lost on the next plugin update). It also exposes the campaign's post_meta
 *   (target / raised / donatur, etc.) as a `meta_all` REST field so the Astro
 *   side does not need to know donasiaja's internal meta-key names.
 *
 * INSTALL
 *   1. Upload this file to: /wp-content/mu-plugins/yah-campaign-rest.php
 *      (create the mu-plugins directory if it does not exist).
 *   2. MU-plugins auto-activate — no admin click needed.
 *   3. Verify: visit https://donasi.yayasanalhidayah.com/wp-json/wp/v2/campaigns
 *      It should return a JSON array of campaigns (not a rest_no_route error).
 *   4. Tell the Astro app the rest_base is "campaigns" (it is, see REST_BASE below).
 *
 * TROUBLESHOOTING
 *   - If /wp-json/wp/v2/campaigns still 404 after install: the donasiaja CPT
 *     probably does not use rewrite slug "campaign". Open WP admin → donasiaja
 *     and note the real CPT slug, then add it to YAH_CAMPAIGN_CPTS below, then
 *     re-save permalinks (Settings → Permalinks → Save).
 *   - Always flush permalinks after activating: Settings → Permalinks → Save.
 * ───────────────────────────────────────────────────────────────────────────
 */

// Candidate internal CPT names for the donasiaja campaign. The plugin's own
// rewrite slug is "campaign" (the public URL is /campaign/<slug>), so the
// auto-discovery below matches that. Add more names here only if discovery
// fails (see TROUBLESHOOTING).
const YAH_CAMPAIGN_CPTS = array( 'campaign', 'donasiaja_campaign', 'dja_campaign' );

// REST base the Astro app will read. Keep in sync with Astro's WP_REST_BASE.
const YAH_CAMPAIGN_REST_BASE = 'campaigns';

/**
 * Flip show_in_rest on for the campaign CPT when donasiaja registers it.
 * Fires during register_post_type() so the change lands before REST routing.
 */
add_filter( 'register_post_type_args', static function ( $args, $post_type ) {
	// Already REST-enabled? Nothing to do.
	if ( ! empty( $args['show_in_rest'] ) ) {
		return $args;
	}

	$rewrite_slug = isset( $args['rewrite']['slug'] ) ? $args['rewrite']['slug'] : $post_type;

	$is_campaign =
		in_array( $post_type, YAH_CAMPAIGN_CPTS, true ) ||
		$rewrite_slug === 'campaign' ||
		( is_string( $args['has_archive'] ?? null ) && $args['has_archive'] === 'campaign' ) ||
		stripos( $post_type, 'campaign' ) !== false;

	if ( ! $is_campaign ) {
		return $args;
	}

	$args['show_in_rest']            = true;
	$args['rest_base']               = YAH_CAMPAIGN_REST_BASE;
	$args['rest_controller_class']   = $args['rest_controller_class'] ?? 'WP_REST_Posts_Controller';

	return $args;
}, 10, 2 );

/**
 * Resolve the actual campaign CPT name (set by the filter above during init)
 * so register_rest_field targets the right post type.
 */
function yah_get_campaign_cpt() {
	static $resolved = null;
	if ( $resolved !== null ) {
		return $resolved;
	}
	foreach ( get_post_types( array(), 'objects' ) as $pt ) {
		if ( ! empty( $pt->show_in_rest ) && $pt->rest_base === YAH_CAMPAIGN_REST_BASE ) {
			$resolved = $pt->name;
			return $resolved;
		}
	}
	$resolved = 'campaign'; // fallback
	return $resolved;
}

/**
 * Expose ALL post_meta for the campaign under `meta_all`. The Astro side scans
 * keys heuristically (target/raised/donatur/terkumpul) so we don't hardcode
 * donasiaja's internal meta-key names — a plugin update can rename them.
 * Internal/protected keys (starting with _) are included because donasiaja
 * stores its stats there; strip any truly sensitive keys before shipping if
 * your install keeps secrets in post_meta.
 */
add_action( 'rest_api_init', static function () {
	$cpt = yah_get_campaign_cpt();

	register_rest_field(
		$cpt,
		'meta_all',
		array(
			'get_callback' => static function ( $post_arr ) {
				$all = get_post_meta( (int) $post_arr['id'] );
				$out = array();
				foreach ( $all as $k => $vals ) {
					$v         = isset( $vals[0] ) ? maybe_unserialize( $vals[0] ) : null;
					$out[ $k ] = $v;
				}
				return $out;
			},
			'schema'       => array( 'type' => 'object', 'description' => 'All campaign post_meta (raw).' ),
		)
	);

	// Convenience: also expose the numeric permalink as `donasi_url` (the same
	// value as `link`, named to match the Astro programs.donasi_url column).
	register_rest_field(
		$cpt,
		'donasi_url',
		array(
			'get_callback' => static function ( $post_arr ) {
				return get_permalink( (int) $post_arr['id'] );
			},
			'schema'       => array( 'type' => 'string', 'format' => 'uri' ),
		)
	);
} );

// Make sure the REST registration runs after donasiaja registers its CPT.
add_action( 'init', static function () {
	// Touch yah_get_campaign_cpt() after all CPTs are registered so the static
	// cache is warm; register_rest_field already hooked on rest_api_init.
	yah_get_campaign_cpt();
}, 100 );
