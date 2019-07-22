module.exports = {
  '*.{js,jsx}': [
    'eslint --format "node_modules/eslint-friendly-formatter" --fix',
    'git add'
  ]
}
