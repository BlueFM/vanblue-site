+++
title = "MIE —— 元积分增强优化器"
description = "对梯度历史叠加多阶积分，用超梯度规则更新系数。已投稿 IEEE Transactions on Cybernetics。"
weight = 2

[extra]
paper = "/zh/papers/meta-integration-enhanced-optimizer/"
+++
<!-- 审稿中：论文接收前不在页面上放具体数字。 -->

DIESGD 把积分阶固定在二阶，因此只能滤除一个有限频段的尖锐极小值——这是对优化问题的局部视角。MIE 机制改为对梯度历史**叠加多阶积分**，每一阶以不同时间尺度重塑损失，产生不会像 EMA 动量那样迅速衰减的推力。

难点在系数。它们的最优值随训练变化，每一阶配一个前馈网络无法扩展，而彼此独立的积分项又会让陈旧信息累积。因此 MIE 用**超梯度规则**更新系数，驱动力来自瞬时梯度与历史积分状态之间的方向一致性。

方法还附带两个理论结果：一个是逃逸时间近似，说明搭载 MIE 的 SGD 更快离开尖锐极小值；另一个通过 Lyapunov 分析给出动力学的局部渐近稳定性。

已投稿 IEEE Transactions on Cybernetics，见[论文页](/zh/papers/meta-integration-enhanced-optimizer/)。
