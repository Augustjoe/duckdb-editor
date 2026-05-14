import { defineComponent, h, PropType } from 'vue'
import { NTree, NIcon, NEmpty } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import { GridOutline, CodeSlashOutline } from '@vicons/ionicons5'

/** 树节点数据结构 */
export interface TreeNodeData extends TreeOption {
  key: string
  label: string
  children?: TreeNodeData[]
  isLeaf?: boolean
  tableName?: string
}

export default defineComponent({
  name: 'SidebarTree',
  props: {
    treeData: {
      type: Array as PropType<TreeNodeData[]>,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    /** NTree on-load 回调：展开表节点时懒加载列信息（PRAGMA table_info） */
    onLoadChildren: {
      type: Function as PropType<(node: TreeNodeData) => Promise<void>>,
      default: undefined,
    },
    /** 刷新按钮点击 */
    onRefresh: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
    /** 双击表节点回调 */
    onNodeDblClick: {
      type: Function as PropType<(node: TreeNodeData) => void>,
      default: undefined,
    },
  },
  setup(props) {
    /** 树节点前缀图标渲染 */
    function renderPrefix({ option }: { option: TreeOption }) {
      const node = option as TreeNodeData
      if (node.isLeaf) {
        return h(NIcon, null, { default: () => h(CodeSlashOutline) })
      }
      return h(NIcon, { color: '#2080f0' }, { default: () => h(GridOutline) })
    }

    /** 为节点绑定双击事件 */
    function nodeProps({ option }: { option: TreeOption }) {
      const node = option as TreeNodeData
      return {
        onDblclick(e: MouseEvent) {
          e.stopPropagation()
          if (node.tableName && props.onNodeDblClick) {
            props.onNodeDblClick(node)
          }
        },
      }
    }

    return () => (
      <div class="sidebar-tree-wrapper">
        {props.treeData.length > 0 ? (
          <NTree
            data={props.treeData}
            blockLine
            accordion
            on-load={(node: TreeOption) => {
              const treeNode = node as TreeNodeData
              if (props.onLoadChildren) {
                return props.onLoadChildren(treeNode)
              }
            }}
            nodeProps={nodeProps}
            keyField="key"
            labelField="label"
            childrenField="children"
            renderPrefix={renderPrefix}
            class="object-tree"
          />
        ) : (
          <NEmpty
            description={props.loading ? '正在加载...' : '暂无表数据'}
            class="tree-empty"
          />
        )}
      </div>
    )
  },
})
