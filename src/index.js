import {
  isArrayExpression,
  isIdentifier,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isImportSpecifier,
  isMemberExpression,
} from '@babel/types'

const REACT_COMPONENT_EXPORT_NAME = 'Component'
const REACT_COMPONENT_RENDER_FUNCTION_NAME = 'render'
const REACT_MODULE_NAME = 'react'
const REACT_PURE_COMPONENT_EXPORT_NAME = 'PureComponent'

export default (context: *): * => {
  const classStack = []
  const functionStack = []

  let componentImportedAs: ?string
  let pureComponentImportedAs: ?string
  let reactImportedAs: ?string

  return {
    ArrowFunctionExpression() {
      functionStack.unshift(false)
    },

    'ArrowFunctionExpression:exit': function() {
      functionStack.shift()
    },

    ImportDeclaration(node: *) {
      const {source, specifiers} = node

      if (source.value === REACT_MODULE_NAME && Array.isArray(specifiers)) {
        for (let i = 0; i < specifiers.length; i++) {
          const specifier = specifiers[i]

          if (
            isImportDefaultSpecifier(specifier) ||
            isImportNamespaceSpecifier(specifier)
          ) {
            reactImportedAs = specifier.local.name
          } else if (isImportSpecifier(specifier)) {
            switch (specifier.imported.name) {
              case REACT_COMPONENT_EXPORT_NAME:
                componentImportedAs = specifier.local.name
                break

              case REACT_PURE_COMPONENT_EXPORT_NAME:
                pureComponentImportedAs = specifier.local.name
                break
            }
          }
        }
      }
    },

    ClassDeclaration(node: *) {
      const {superClass} = node

      if (superClass) {
        if (isIdentifier(superClass)) {
          if (
            (componentImportedAs && superClass.name === componentImportedAs) ||
            (pureComponentImportedAs &&
              superClass.name === pureComponentImportedAs)
          ) {
            classStack.unshift(true)
            return
          }
        } else if (isMemberExpression(superClass)) {
          if (
            reactImportedAs &&
            superClass.object.name === reactImportedAs &&
            [
              REACT_COMPONENT_EXPORT_NAME,
              REACT_PURE_COMPONENT_EXPORT_NAME,
            ].includes(superClass.property.name)
          ) {
            classStack.unshift(true)
            return
          }
        }
      }

      classStack.push(false)
    },

    'ClassDeclaration:exit': function(node: *) {
      classStack.shift()
    },

    FunctionDeclaration() {
      functionStack.unshift(false)
    },

    'FunctionDeclaration:exit': function() {
      functionStack.shift()
    },

    MethodDefinition(node: *) {
      functionStack.unshift(
        node.key.name === REACT_COMPONENT_RENDER_FUNCTION_NAME,
      )
    },

    'MethodDefinition:exit': function() {
      functionStack.shift()
    },

    ReturnStatement(node: *) {
      if (
        (classStack[0] && functionStack[0]) ||
        (reactImportedAs &&
          classStack.length === 0 &&
          functionStack.length === 1)
      ) {
        const {argument} = node

        if (isArrayExpression(argument)) {
          context.report({
            message:
              "Don't return an array fron a React component's render method.",
            node: node.argument,
          })
        }
      }
    },
  }
}