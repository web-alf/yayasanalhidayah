<?php
/**
 * Plugin Name:       Yayasan Al-Hidayah — Campaign REST
 * Plugin URI:        https://yayasanalhidayah.com
 * Description:       Exposes the donasiaja donation "campaign" post type via the WP REST API at /wp-json/wp/v2/campaigns so the Astro site (yayasanalhidayah.com) can fetch live campaign data (target, raised, donatur). Installable plugin — activate from Plugins, no file editing.
 * Version:           1.0.0
 * Author:            Yayasan Al-Hidayah
 * Author URI:        https://yayasanalhidayah.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Text Domain:       yah-campaign-rest
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   The donasiaja plugin (v2.x) registers its campaign post type with
 *   show_in_rest = false, so GET /wp-json/wp/v2/campaign returns 404. This
 *   plugin flips it on WITHOUT editing the donasiaja plugin (edits would be
 *   lost on the next plugin update) and exposes the campaign's post_meta
 *   (target / raised / donatur) as a `meta_all` REST field so the Astro side
 *   does not need to hardcode donasiaja's internal meta-key names.
 *
 * INSTALL (no FTP needed)
 *   1. Zip this plugin folder as yah-campaign-rest.zip (the repo ships the zip).
 *   2. WP Admin → Plugins → Add New → Upload Plugin → choose the zip → Install.
 *   3. Click Activate. Activation auto-flushes permalinks — nothing else to do.
 *   4. Verify: open https://donasi.yayasanalhidayah.com/wp-json/wp/v2/campaigns
 *      It should return a JSON array of campaigns (not rest_no_route 404).
 *      The Plugins screen also shows a green/red status notice for this plugin.
 *
 * Do NOT run this AND the mu-plugin version at the same time — pick one.
 * ───────────────────────────────────────────────────────────────────────────
 */

// Block direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'YAH_Campaign_REST' ) ) :

final class YAH_Campaign_REST {

	/** Candidate internal CPT names for the donasiaja campaign. */
	const CPTS = array( 'campaign', 'donasiaja_campaign', 'dja_campaign' );

	/** REST base the Astro app reads. Keep in sync with Astro's WP_REST_BASE. */
	const REST_BASE = 'campaigns';

	/** Option flag: flush rewrite rules once after (de)activation. */
	const FLUSH_FLAG = 'yah_campaign_rest_flush';

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_filter( 'register_post_type_args', array( $this, 'enable_rest' ), 10, 2 );
		add_action( 'rest_api_init', array( $this, 'register_fields' ) );
		add_action( 'init', array( $this, 'maybe_flush' ), 999 );
		add_action( 'admin_notices', array( $this, 'status_notice' ) );
	}

	/** Flip show_in_rest on for the campaign CPT as donasiaja registers it. */
	public function enable_rest( $args, $post_type ) {
		if ( ! empty( $args['show_in_rest'] ) ) {
			return $args;
		}

		$rewrite_slug = isset( $args['rewrite']['slug'] ) ? $args['rewrite']['slug'] : $post_type;

		$is_campaign =
			in_array( $post_type, self::CPTS, true ) ||
			'campaign' === $rewrite_slug ||
			( is_string( $args['has_archive'] ?? null ) && 'campaign' === $args['has_archive'] ) ||
			false !== stripos( $post_type, 'campaign' );

		if ( ! $is_campaign ) {
			return $args;
		}

		$args['show_in_rest']          = true;
		$args['rest_base']             = self::REST_BASE;
		$args['rest_controller_class'] = $args['rest_controller_class'] ?? 'WP_REST_Posts_Controller';

		return $args;
	}

	/** Resolve the actual campaign CPT name (set by enable_rest during init). */
	public function campaign_cpt() {
		static $resolved = null;
		if ( null !== $resolved ) {
			return $resolved;
		}
		foreach ( get_post_types( array(), 'objects' ) as $pt ) {
			if ( ! empty( $pt->show_in_rest ) && self::REST_BASE === $pt->rest_base ) {
				$resolved = $pt->name;
				return $resolved;
			}
		}
		$resolved = 'campaign';
		return $resolved;
	}

	/** Expose all post_meta (`meta_all`) + a `donasi_url` convenience field. */
	public function register_fields() {
		$cpt = $this->campaign_cpt();

		register_rest_field(
			$cpt,
			'meta_all',
			array(
				'get_callback' => static function ( $post_arr ) {
					$all = get_post_meta( (int) $post_arr['id'] );
					$out = array();
					foreach ( $all as $k => $vals ) {
						$out[ $k ] = isset( $vals[0] ) ? maybe_unserialize( $vals[0] ) : null;
					}
					return $out;
				},
				'schema'       => array(
					'type'        => 'object',
					'description' => 'All campaign post_meta (raw).',
				),
			)
		);

		register_rest_field(
			$cpt,
			'donasi_url',
			array(
				'get_callback' => static function ( $post_arr ) {
					return get_permalink( (int) $post_arr['id'] );
				},
				'schema'       => array(
					'type'   => 'string',
					'format' => 'uri',
				),
			)
		);
	}

	/** Flush rewrite rules once after activation/deactivation. */
	public function maybe_flush() {
		$this->campaign_cpt(); // warm the static cache
		if ( get_option( self::FLUSH_FLAG ) ) {
			flush_rewrite_rules( false );
			delete_option( self::FLUSH_FLAG );
		}
	}

	/** Admin notice on the Plugins screen: is the endpoint live? */
	public function status_notice() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'plugins' !== $screen->id ) {
			return;
		}
		$cpt    = $this->campaign_cpt();
		$exists = post_type_exists( $cpt );
		$obj    = $exists ? get_post_type_object( $cpt ) : null;
		$live   = $obj && ! empty( $obj->show_in_rest );
		$url    = home_url( '/wp-json/wp/v2/' . self::REST_BASE );

		if ( $live ) {
			printf(
				'<div class="notice notice-success is-dismissible"><p><strong>Campaign REST aktif.</strong> Endpoint: <a href="%s" target="_blank" rel="noopener">%s</a></p></div>',
				esc_url( $url ),
				esc_html( $url )
			);
		} else {
			printf(
				'<div class="notice notice-warning is-dismissible"><p><strong>Campaign REST belum menemukan CPT campaign.</strong> Pastikan plugin donasiaja aktif, lalu buka Settings → Permalinks → Save. Jika CPT-nya bukan "campaign", tambahkan namanya ke YAH_Campaign_REST::CPTS.</p></div>'
			);
		}
	}

	/** Activation: mark for a rewrite flush on the next init. */
	public static function activate() {
		update_option( self::FLUSH_FLAG, 1 );
	}

	/** Deactivation: flush so the (now-removed) rest_base routing is cleaned. */
	public static function deactivate() {
		update_option( self::FLUSH_FLAG, 1 );
		flush_rewrite_rules( false );
	}
}

endif;

register_activation_hook( __FILE__, array( 'YAH_Campaign_REST', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'YAH_Campaign_REST', 'deactivate' ) );

YAH_Campaign_REST::instance();
