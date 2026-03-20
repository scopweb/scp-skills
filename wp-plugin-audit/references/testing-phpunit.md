# Testing en Plugins WordPress — PHPUnit, WP_Mock, PHPCS

Setup y patrones para plugins privados. Enfoque en tests rápidos con WP_Mock
(sin WordPress real) + PHPCS para estándares de código.

---

## 1. Instalación

```bash
# Instalar dependencias de dev
composer require --dev \
    phpunit/phpunit:^10.0 \
    10up/wp_mock:^1.0 \
    squizlabs/php_codesniffer:^3.7 \
    wp-coding-standards/wpcs:^3.0 \
    dealerdirect/phpcodesniffer-composer-installer:^1.0

# Verificar que WPCS se registró
./vendor/bin/phpcs -i | grep WordPress
```

---

## 2. phpunit.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
    bootstrap="tests/bootstrap.php"
    colors="true"
    testdox="true"
>
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>src</directory>
        </include>
    </source>
    <coverage>
        <report>
            <html outputDirectory="coverage"/>
        </report>
    </coverage>
</phpunit>
```

---

## 3. tests/bootstrap.php

```php
<?php
declare(strict_types=1);

// Composer autoload
require_once dirname(__DIR__) . '/vendor/autoload.php';

// Constantes que el plugin necesita
define('ABSPATH', '/tmp/wordpress/');
define('MY_PLUGIN_VERSION', '1.0.0');
define('MY_PLUGIN_DIR', dirname(__DIR__) . '/');
define('MY_PLUGIN_URL', 'http://example.com/wp-content/plugins/my-plugin/');

// Inicializar WP_Mock
WP_Mock::bootstrap();
```

---

## 4. Clase base para tests

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Tests;

use WP_Mock\Tools\TestCase;

abstract class PluginTestCase extends TestCase {
    protected function setUp(): void {
        parent::setUp();
        WP_Mock::setUp();
    }

    protected function tearDown(): void {
        WP_Mock::tearDown();
        parent::tearDown();
    }
}
```

---

## 5. Test de seguridad — nonce y capability check

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Tests\Unit;

use MyPlugin\Tests\PluginTestCase;
use MyPlugin\Admin\SettingsPage;

class SettingsPageSecurityTest extends PluginTestCase {

    public function test_save_settings_requires_nonce(): void {
        // Sin nonce en $_POST
        $_POST = ['my_setting' => 'value'];

        WP_Mock::userFunction('wp_verify_nonce')->never();
        WP_Mock::userFunction('update_option')->never();

        $page = new SettingsPage();
        $page->save();

        $this->assertConditionsMet();
    }

    public function test_save_settings_requires_capability(): void {
        $_POST = [
            'my_plugin_nonce' => 'valid_nonce',
            'my_setting'      => 'value',
        ];

        WP_Mock::userFunction('wp_verify_nonce')
            ->once()
            ->with('valid_nonce', 'my_plugin_save_settings')
            ->andReturn(true);

        WP_Mock::userFunction('current_user_can')
            ->once()
            ->with('manage_options')
            ->andReturn(false); // Usuario sin permisos

        WP_Mock::userFunction('update_option')->never();

        $page = new SettingsPage();
        $page->save();

        $this->assertConditionsMet();
    }

    public function test_save_settings_sanitizes_input(): void {
        $dirty_input = '<script>alert("xss")</script>My Value';
        $_POST = [
            'my_plugin_nonce' => 'valid_nonce',
            'my_setting'      => $dirty_input,
        ];

        WP_Mock::userFunction('wp_verify_nonce')
            ->once()
            ->andReturn(true);

        WP_Mock::userFunction('current_user_can')
            ->once()
            ->with('manage_options')
            ->andReturn(true);

        WP_Mock::userFunction('sanitize_text_field')
            ->once()
            ->with($dirty_input)
            ->andReturn('My Value'); // WP sanitiza

        WP_Mock::userFunction('wp_unslash')
            ->andReturnArg(0);

        WP_Mock::userFunction('update_option')
            ->once()
            ->with('my_plugin_setting', 'My Value');

        $page = new SettingsPage();
        $page->save();

        $this->assertConditionsMet();
    }
}
```

---

## 6. Test de CPT

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Tests\Unit\PostTypes;

use MyPlugin\Tests\PluginTestCase;
use MyPlugin\PostTypes\ProductCPT;

class ProductCPTTest extends PluginTestCase {

    public function test_registers_post_type_on_init(): void {
        WP_Mock::expectActionAdded('init', [new ProductCPT(), 'register_post_type']);

        $cpt = new ProductCPT();
        $cpt->register();

        $this->assertConditionsMet();
    }

    public function test_save_meta_bails_on_autosave(): void {
        $post_id = 123;

        WP_Mock::userFunction('wp_is_post_autosave')
            ->once()
            ->with($post_id)
            ->andReturn(true);

        // wp_verify_nonce nunca debe llamarse en autosave
        WP_Mock::userFunction('wp_verify_nonce')->never();

        $cpt = new ProductCPT();
        $cpt->save_meta($post_id, (object)['post_status' => 'auto-draft']);

        $this->assertConditionsMet();
    }

    public function test_save_meta_rejects_invalid_nonce(): void {
        $post_id = 123;
        $_POST = ['my_product_meta_nonce' => 'bad_nonce'];

        WP_Mock::userFunction('wp_is_post_autosave')->andReturn(false);
        WP_Mock::userFunction('wp_is_post_revision')->andReturn(false);
        WP_Mock::userFunction('sanitize_text_field')->andReturnArg(0);
        WP_Mock::userFunction('wp_unslash')->andReturnArg(0);

        WP_Mock::userFunction('wp_verify_nonce')
            ->once()
            ->with('bad_nonce', 'my_product_meta_' . $post_id)
            ->andReturn(false);

        WP_Mock::userFunction('update_post_meta')->never();

        $cpt = new ProductCPT();
        $cpt->save_meta($post_id, (object)[]);

        $this->assertConditionsMet();
    }
}
```

---

## 7. .phpcs.xml.dist

```xml
<?xml version="1.0"?>
<ruleset name="MyPlugin">
    <description>PHP CodeSniffer rules for My Plugin</description>

    <!-- Qué analizar -->
    <file>src</file>
    <file>my-plugin.php</file>

    <!-- Excluir vendor y tests de algunos sniffs -->
    <exclude-pattern>vendor/*</exclude-pattern>
    <exclude-pattern>tests/*</exclude-pattern>

    <!-- PHP mínimo -->
    <config name="minimum_supported_wp_version" value="6.0"/>
    <config name="testVersion" value="8.1-"/>

    <!-- Reglas base -->
    <rule ref="WordPress-Extra">
        <!-- Permitir short array syntax [] -->
        <exclude name="Universal.Arrays.DisallowShortArraySyntax"/>
    </rule>
    <rule ref="WordPress-Docs"/>

    <!-- Namespace del plugin para checks de prefix -->
    <rule ref="WordPress.NamingConventions.PrefixAllGlobals">
        <properties>
            <property name="prefixes" type="array">
                <element value="my_plugin"/>
                <element value="MyPlugin"/>
            </property>
        </properties>
    </rule>

    <!-- Text domain -->
    <rule ref="WordPress.WP.I18n">
        <properties>
            <property name="text_domain" type="array">
                <element value="my-plugin"/>
            </property>
        </properties>
    </rule>
</ruleset>
```

---

## 8. GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  phpcs:
    name: Code Standards
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.1'
          tools: composer
      - run: composer install --no-interaction
      - run: composer lint

  phpunit:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        php: ['8.1', '8.2', '8.3']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php }}
          tools: composer
          coverage: xdebug
      - run: composer install --no-interaction
      - run: composer test -- --coverage-text
```

---

## 9. Comandos de uso frecuente

```bash
# Ejecutar tests
composer test

# Tests con output detallado
./vendor/bin/phpunit --testdox

# Solo un archivo de test
./vendor/bin/phpunit tests/Unit/PostTypes/ProductCPTTest.php

# PHPCS — ver errores
composer lint

# PHPCBF — auto-fix lo que pueda
composer lint-fix

# PHPCS sobre un archivo concreto
./vendor/bin/phpcs src/Admin/SettingsPage.php

# Ver cobertura (requiere Xdebug)
./vendor/bin/phpunit --coverage-html coverage/
open coverage/index.html
```
