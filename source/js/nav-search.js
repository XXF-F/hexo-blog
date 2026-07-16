(function () {
  function openSearch() {
    const btn = document.querySelector('#search-button .search');
    if (btn) btn.click();
  }

  function addSidebarSearch() {
    if (document.querySelector('#sidebar-menus .sidebar-search')) return;
    const menus = document.querySelector('#sidebar-menus .menus_items');
    if (!menus || !document.querySelector('#search-button')) return;

    const item = document.createElement('div');
    item.className = 'menus_item sidebar-search';
    item.innerHTML = '<a class="site-page" href="#"><i class="fa-fw fas fa-search"></i><span> 搜索文章</span></a>';
    item.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      openSearch();
    });
    menus.insertBefore(item, menus.firstChild);
  }

  document.addEventListener('DOMContentLoaded', addSidebarSearch);
  document.addEventListener('pjax:complete', addSidebarSearch);
})();
