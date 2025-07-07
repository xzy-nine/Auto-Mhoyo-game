/**
 * 动画性能优化工具
 * 提供高性能的动画帮助函数和优化工具
 */

class AnimationOptimizer {
    constructor() {
        this.rafId = null;
        this.animationQueue = [];
        this.isAnimating = false;
    }

    /**
     * 高性能的元素动画函数
     * @param {HTMLElement} element - 要动画的元素
     * @param {Object} options - 动画选项
     */
    animate(element, options = {}) {
        const {
            duration = 200,
            easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            properties = {},
            onComplete = null
        } = options;

        // 添加will-change提示浏览器优化
        const willChangeProperties = Object.keys(properties).join(', ');
        element.style.willChange = willChangeProperties;

        // 应用transition
        element.style.transition = `all ${duration}ms ${easing}`;

        // 应用属性变化
        Object.entries(properties).forEach(([prop, value]) => {
            element.style[prop] = value;
        });

        // 清理will-change
        setTimeout(() => {
            element.style.willChange = 'auto';
            if (onComplete) onComplete();
        }, duration);
    }

    /**
     * 批量动画处理，减少重排重绘
     * @param {Array} animations - 动画数组
     */
    batchAnimate(animations) {
        requestAnimationFrame(() => {
            animations.forEach(({ element, properties }) => {
                Object.entries(properties).forEach(([prop, value]) => {
                    element.style[prop] = value;
                });
            });
        });
    }

    /**
     * 平滑滚动到指定位置
     * @param {HTMLElement} container - 滚动容器
     * @param {number} targetY - 目标位置
     * @param {number} duration - 动画时长
     */
    smoothScrollTo(container, targetY, duration = 300) {
        const startY = container.scrollTop;
        const distance = targetY - startY;
        const startTime = performance.now();

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用easeOutCubic缓动函数
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            container.scrollTop = startY + (distance * easeProgress);

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };

        requestAnimationFrame(animateScroll);
    }

    /**
     * 防抖动画函数
     * @param {Function} animationFn - 动画函数
     * @param {number} delay - 防抖延迟
     */
    debounceAnimation(animationFn, delay = 16) {
        return (...args) => {
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }
            
            this.rafId = requestAnimationFrame(() => {
                setTimeout(() => {
                    animationFn.apply(this, args);
                }, delay);
            });
        };
    }

    /**
     * 节流动画函数
     * @param {Function} animationFn - 动画函数
     * @param {number} interval - 节流间隔
     */
    throttleAnimation(animationFn, interval = 16) {
        let lastCall = 0;
        
        return (...args) => {
            const now = performance.now();
            
            if (now - lastCall >= interval) {
                lastCall = now;
                requestAnimationFrame(() => {
                    animationFn.apply(this, args);
                });
            }
        };
    }

    /**
     * 高性能的类切换动画
     * @param {HTMLElement} element - 目标元素
     * @param {string} className - 类名
     * @param {number} duration - 动画时长
     */
    toggleClassWithAnimation(element, className, duration = 200) {
        // 避免重复动画
        if (element.classList.contains('animating')) {
            return;
        }

        element.classList.add('animating');
        element.classList.toggle(className);

        setTimeout(() => {
            element.classList.remove('animating');
        }, duration);
    }

    /**
     * 优化的进度条动画
     * @param {HTMLElement} progressBar - 进度条元素
     * @param {number} targetPercent - 目标百分比
     * @param {number} duration - 动画时长
     */
    animateProgress(progressBar, targetPercent, duration = 300) {
        const startPercent = parseFloat(progressBar.style.width) || 0;
        const difference = targetPercent - startPercent;
        const startTime = performance.now();

        const updateProgress = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用easeOutQuart缓动
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentPercent = startPercent + (difference * easeProgress);
            
            progressBar.style.width = `${currentPercent}%`;

            if (progress < 1) {
                requestAnimationFrame(updateProgress);
            }
        };

        requestAnimationFrame(updateProgress);
    }

    /**
     * 启用硬件加速
     * @param {HTMLElement} element - 目标元素
     */
    enableHardwareAcceleration(element) {
        element.style.transform = 'translate3d(0, 0, 0)';
        element.style.backfaceVisibility = 'hidden';
        element.style.perspective = '1000px';
    }

    /**
     * 批量启用硬件加速
     * @param {string} selector - CSS选择器
     */
    enableHardwareAccelerationBatch(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            this.enableHardwareAcceleration(element);
        });
    }

    /**
     * 清理所有动画
     */
    cleanup() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.animationQueue = [];
        this.isAnimating = false;
    }
}

// 创建全局实例
const animationOptimizer = new AnimationOptimizer();

// 页面加载完成后启用硬件加速
document.addEventListener('DOMContentLoaded', () => {
    // 为常用元素启用硬件加速
    animationOptimizer.enableHardwareAccelerationBatch(`
        .btn,
        .game-card,
        .status-card,
        .nav-item,
        .setting-item,
        .modern-toggle .toggle-slider,
        .progress-fill,
        .loading-spinner
    `);
});

// 导出给全局使用
window.AnimationOptimizer = AnimationOptimizer;
window.animationOptimizer = animationOptimizer;
