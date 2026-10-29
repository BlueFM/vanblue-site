+++
title = "Enhancing Generalisation via Cascaded Inertia SGD With Learnt Hyperparameters"
description = "用神经动力学构造的二阶积分惯性项把 SGD 推向平坦极小值，其系数由轻量网络离线学习得到。"
date = 2026-02-18
weight = 1
authors = ["Yongji Guan", "Shunbao Zhang", "Longbang Wang", "Erchao Li"]

[extra]
venue = "CAAI Transactions on Intelligence Technology"
details = "第 11 卷第 4 期，1019–1027 页"
doi = "10.1049/cit2.70111"
pdf = "/papers/guan-2026-cascaded-inertia-sgd.pdf"
# NOTE: 作者列表、卷期页码与日期已按 DOI 在 Crossref 上核对。
+++
**一句话** —— 在 SGD 里加入二阶积分（级联惯性）项，可以在训练过程中滤除尖锐极小值；控制这一项的几个系数不需要手工调，由一个小网络离线学出来。

## 问题

平坦极小值通常对应更好的泛化与鲁棒性，但原始 SGD 和动量法对"模型最终落进多尖锐的盆地"没有任何直接的控制手段。已有的锐度感知方法要为这种控制付出额外的正反向传播，或者依赖手工设计的调度策略。

## 方法

我们把参数训练建模为神经动力学系统，引入级联积分惯性项。积分算子对梯度信号起低通滤波作用，等价于在损失曲面上削掉尖锐区域；四个控制更新的系数由一个轻量前馈网络预测——它在带噪梯度上离线训练，训练目标来自神经动力学误差方程。

## 结果

在图像分类与遥感数据集上的对比实验中，该方法相对标准基线取得一致提升，且训练时没有可测的单步额外开销。

*本文以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可开放获取发表，上方 PDF 为出版社正式版本。*
