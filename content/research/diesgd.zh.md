+++
title = "DIESGD —— 级联惯性优化器"
description = "由神经动力学导出的二阶惯性，把训练导向平坦极小值。"
date = 2026-02-18
weight = 1

[extra]
paper = "/zh/papers/cascaded-inertia-sgd/"
+++
<!-- TODO: 把架构图 / 损失景观图放到 static/img/ 后在此引用。 -->

标准动量携带的是一阶历史，它并不关心模型最终落进的是尖锐盆地还是平坦盆地。

DIESGD 加入**二阶积分项**：梯度信号在进入更新前被积分两次，相当于在损失曲面上做低通滤波，削掉那些损害泛化的尖锐成分。加权这几项的四个系数不是手工调的——由一个小前馈网络预测，它通过神经动力学误差方程在带噪梯度上离线训练。

已发表为[《Enhancing Generalisation via Cascaded Inertia SGD With Learnt Hyperparameters》](/zh/papers/cascaded-inertia-sgd/)。
