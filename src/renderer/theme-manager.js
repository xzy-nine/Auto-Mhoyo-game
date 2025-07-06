/**
 * 主题管理器
 * 管理深色模式和浅色模式的切换
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.systemPreference = false;
        this.themePreference = 'light';
        this.storageKey = 'auto-mihoyo-theme-settings';
        
        this.init();
    }

    /**
     * 初始化主题管理器
     */
    init() {
        this.loadThemeSettings();
        this.detectSystemTheme();
        this.applyInitialTheme();
        this.setupSystemThemeListener();
        this.setupEventListeners();
    }

    /**
     * 加载主题设置
     */
    loadThemeSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                this.systemPreference = settings.systemPreference || false;
                this.themePreference = settings.themePreference || 'light';
            }
        } catch (error) {
            console.warn('Failed to load theme settings:', error);
        }
    }

    /**
     * 保存主题设置
     */
    saveThemeSettings() {
        try {
            const settings = {
                systemPreference: this.systemPreference,
                themePreference: this.themePreference
            };
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save theme settings:', error);
        }
    }

    /**
     * 检测系统主题偏好
     */
    detectSystemTheme() {
        if (window.matchMedia) {
            const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.systemTheme = darkQuery.matches ? 'dark' : 'light';
        } else {
            this.systemTheme = 'light';
        }
    }

    /**
     * 应用初始主题
     */
    applyInitialTheme() {
        if (this.systemPreference) {
            this.currentTheme = this.systemTheme;
        } else {
            this.currentTheme = this.themePreference;
        }
        this.applyTheme(this.currentTheme);
        this.updateThemeControls();
    }

    /**
     * 设置系统主题监听器
     */
    setupSystemThemeListener() {
        if (window.matchMedia) {
            const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkQuery.addEventListener('change', (e) => {
                this.systemTheme = e.matches ? 'dark' : 'light';
                if (this.systemPreference) {
                    this.currentTheme = this.systemTheme;
                    this.applyTheme(this.currentTheme);
                }
            });
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 等待DOM加载完成后设置监听器
        document.addEventListener('DOMContentLoaded', () => {
            this.bindThemeControls();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindThemeControls();
            });
        } else {
            this.bindThemeControls();
        }
    }

    /**
     * 绑定主题控制元素
     */
    bindThemeControls() {
        const followSystemCheckbox = document.getElementById('followSystemTheme');
        const themeSelect = document.getElementById('themeMode');
        // 主题切换按钮已移除，不需要绑定事件

        if (followSystemCheckbox) {
            followSystemCheckbox.addEventListener('change', (e) => {
                this.setSystemPreference(e.target.checked);
            });
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.setThemePreference(e.target.value);
            });
        }

        this.updateThemeControls();
    }

    /**
     * 更新主题控制元素状态
     */
    updateThemeControls() {
        const followSystemCheckbox = document.getElementById('followSystemTheme');
        const themeSelect = document.getElementById('themeMode');
        // 主题切换按钮已移除，不需要更新状态

        if (followSystemCheckbox) {
            followSystemCheckbox.checked = this.systemPreference;
        }

        if (themeSelect) {
            themeSelect.value = this.themePreference;
            themeSelect.disabled = this.systemPreference;
        }
    }

    /**
     * 设置是否跟随系统主题
     */
    setSystemPreference(follow) {
        this.systemPreference = follow;
        
        if (follow) {
            this.currentTheme = this.systemTheme;
        } else {
            this.currentTheme = this.themePreference;
        }
        
        this.applyTheme(this.currentTheme);
        this.updateThemeControls();
        this.saveThemeSettings();
    }

    /**
     * 设置主题偏好
     */
    setThemePreference(theme) {
        this.themePreference = theme;
        
        if (!this.systemPreference) {
            this.currentTheme = theme;
            this.applyTheme(this.currentTheme);
        }
        
        this.saveThemeSettings();
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        
        // 如果当前跟随系统，则关闭跟随系统
        if (this.systemPreference) {
            this.systemPreference = false;
        }
        
        this.themePreference = newTheme;
        this.currentTheme = newTheme;
        
        this.applyTheme(this.currentTheme);
        this.updateThemeControls();
        this.saveThemeSettings();
    }

    /**
     * 应用主题
     */
    applyTheme(theme) {
        const body = document.body;
        
        // 移除现有主题类
        body.classList.remove('light-theme', 'dark-theme');
        
        // 添加新主题类
        body.classList.add(`${theme}-theme`);
        
        // 设置CSS自定义属性
        this.setCSSVariables(theme);
        
        // 触发主题变更事件
        this.dispatchThemeChangeEvent(theme);
    }

    /**
     * 设置CSS自定义属性
     */
    setCSSVariables(theme) {
        const root = document.documentElement;
        
        if (theme === 'dark') {
            // 深色主题变量
            root.style.setProperty('--bg-primary', '#1a1a1a');
            root.style.setProperty('--bg-secondary', '#2d2d2d');
            root.style.setProperty('--bg-tertiary', '#3a3a3a');
            root.style.setProperty('--bg-quaternary', '#4a4a4a');
            
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#cccccc');
            root.style.setProperty('--text-tertiary', '#999999');
            
            root.style.setProperty('--border-color', '#444444');
            root.style.setProperty('--border-light', '#333333');
            
            root.style.setProperty('--shadow-primary', 'rgba(0, 0, 0, 0.5)');
            root.style.setProperty('--shadow-secondary', 'rgba(0, 0, 0, 0.3)');
            
            root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)');
            root.style.setProperty('--gradient-secondary', 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)');
            
            root.style.setProperty('--glass-bg', 'rgba(45, 45, 45, 0.9)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        } else {
            // 浅色主题变量
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f8f9fa');
            root.style.setProperty('--bg-tertiary', '#e9ecef');
            root.style.setProperty('--bg-quaternary', '#dee2e6');
            
            root.style.setProperty('--text-primary', '#333333');
            root.style.setProperty('--text-secondary', '#666666');
            root.style.setProperty('--text-tertiary', '#999999');
            
            root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--border-light', 'rgba(0, 0, 0, 0.05)');
            
            root.style.setProperty('--shadow-primary', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--shadow-secondary', 'rgba(0, 0, 0, 0.05)');
            
            root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
            root.style.setProperty('--gradient-secondary', 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)');
            
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
        }
    }

    /**
     * 触发主题变更事件
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: { theme, themeManager: this }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * 获取系统主题
     */
    getSystemTheme() {
        return this.systemTheme;
    }

    /**
     * 是否跟随系统主题
     */
    isFollowingSystem() {
        return this.systemPreference;
    }

    /**
     * 获取主题偏好
     */
    getThemePreference() {
        return this.themePreference;
    }
}

// 创建全局主题管理器实例
window.themeManager = new ThemeManager();
