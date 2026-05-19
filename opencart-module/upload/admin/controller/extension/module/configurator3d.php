<?php
// admin/controller/extension/module/configurator3d.php
// Управляет установкой/удалением — добавляет колонку cfg3d_enabled в oc_product.

class ControllerExtensionModuleConfigurator3d extends Controller {

	public function index() {
		$this->load->language('extension/module/configurator3d');
		$this->document->setTitle($this->language->get('heading_title'));

		$data['heading_title']  = $this->language->get('heading_title');
		$data['text_intro']     = $this->language->get('text_intro');
		$data['button_install'] = $this->language->get('button_install');
		$data['button_uninstall'] = $this->language->get('button_uninstall');

		$data['installed'] = $this->isColumnInstalled();

		$data['install_url']   = $this->url->link('extension/module/configurator3d/install',   'user_token=' . $this->session->data['user_token'], true);
		$data['uninstall_url'] = $this->url->link('extension/module/configurator3d/uninstall', 'user_token=' . $this->session->data['user_token'], true);
		$data['back_url']      = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);

		$data['breadcrumbs'] = array(
			array('text' => $this->language->get('text_home'), 'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)),
			array('text' => $this->language->get('text_extension'), 'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true)),
			array('text' => $this->language->get('heading_title'), 'href' => $this->url->link('extension/module/configurator3d', 'user_token=' . $this->session->data['user_token'], true)),
		);

		$data['header']      = $this->load->controller('common/header');
		$data['column_left'] = $this->load->controller('common/column_left');
		$data['footer']      = $this->load->controller('common/footer');

		$this->response->setOutput($this->load->view('extension/module/configurator3d', $data));
	}

	// ===== Стандартные хуки OpenCart при установке/удалении модуля =====

	public function install() {
		$this->ensureColumn();
	}

	public function uninstall() {
		// Колонку не удаляем — иначе при пересборке на проде потеряем флажки.
		// Если действительно нужно — расскоментируйте:
		// $this->db->query("ALTER TABLE `" . DB_PREFIX . "product` DROP COLUMN `cfg3d_enabled`");
	}

	private function ensureColumn() {
		$query = $this->db->query("SHOW COLUMNS FROM `" . DB_PREFIX . "product` LIKE 'cfg3d_enabled'");
		if (!$query->num_rows) {
			$this->db->query("ALTER TABLE `" . DB_PREFIX . "product` ADD COLUMN `cfg3d_enabled` TINYINT(1) NOT NULL DEFAULT 0");
		}
	}

	private function isColumnInstalled() {
		$query = $this->db->query("SHOW COLUMNS FROM `" . DB_PREFIX . "product` LIKE 'cfg3d_enabled'");
		return $query->num_rows > 0;
	}
}
